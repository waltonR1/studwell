import {randomUUID} from 'node:crypto'
import {createServer} from 'node:http'
import type {AddressInfo} from 'node:net'
import {createApp, createRouter, toNodeListener} from 'h3'
import {eq} from 'drizzle-orm'
import {afterAll, beforeAll, expect, it} from 'vitest'
import {inquiryListSchema} from '../../shared/schemas/admin/inquiries'
import {inquirySubmissionSchema} from '../../shared/schemas/public/inquiries'
import {inquirySettingsUpdateSchema} from '../../shared/schemas/admin/inquiry-settings'
import {beijingDate} from '../../shared/utils/beijing-time'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {adminOperationLogs, adminPermissions, adminRoles, adminRolePermissions, adminUserRoles, adminUsers, customerInquiries} from '../../server/db/schema'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import {createInquiryService} from '../../server/services/inquiries'
import {deliverInquiryMail} from '../../server/services/inquiry-mail'
import type {InquiryEnvelope} from '../../server/core/inquiry-mail'
import {getInquirySettings, publicInquiryCategories, updateInquirySettings} from '../../server/services/inquiry-settings'
import {createMenuService} from '../../server/services/menus'
import {createRbacService} from '../../server/services/rbac'
import {publicInquiryHandler} from '../../server/http/handlers/public-inquiry-handler'
import {cleanTestDatabase, setupTestDatabase} from './support'

let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, reader: bigint, handler: bigint
const password = 'Inquiry fixture Summer Aurora 8462!'
const meta = () => ({ip: '127.0.0.1', userAgent: 'test', requestId: randomUUID()})

beforeAll(async () => {
    client = await setupTestDatabase()
    const db = client.database
    root = BigInt((await seedRoot(db, password)).id)
    const accounts = createAccountService(db, false)
    reader = BigInt((await accounts.createOrdinary({username: 'inquiry_reader', displayName: 'Reader', password}, String(root))).id)
    handler = BigInt((await accounts.createOrdinary({username: 'inquiry_handler', displayName: 'Handler', password}, String(root))).id)
    await db.update(adminUsers).set({mustChangePassword: false})
    await createRbacService(db).sync()
    const readRole = await withEntityIds(db, 'admin_roles', {code: 'inquiry_read', name: 'Read inquiries'})
    const updateRole = await withEntityIds(db, 'admin_roles', {code: 'inquiry_update', name: 'Update inquiries'})
    await db.insert(adminRoles).values([readRole, updateRole])
    const permissions = await db.select().from(adminPermissions)
    await db.insert(adminRolePermissions).values([
        {roleId: readRole.id, permissionId: permissions.find(row => row.code === 'content.inquiries.read')!.id},
        {roleId: updateRole.id, permissionId: permissions.find(row => row.code === 'content.inquiries.update')!.id},
    ])
    await db.insert(adminUserRoles).values([
        {userId: reader, roleId: readRole.id},
        {userId: handler, roleId: readRole.id}, {userId: handler, roleId: updateRole.id},
    ])
})
afterAll(async () => { if (client) await cleanTestDatabase(client) })

it('未配置咨询分类时可维护设置，公开分类为空且拒绝提交',async()=>{
 const db=client.database,original=await getInquirySettings(db,root,false)
 const saved=await updateInquirySettings(db,root,meta(),{version:original.version,settings:{...original.settings,categories:[]}},false)
 try{
  expect(await publicInquiryCategories(db,'zh')).toEqual([])
  const input=inquirySubmissionSchema.parse({submissionKey:randomUUID(),locale:'zh',category:'export',name:'测试客户',email:'fixture@example.com',company:'',country:'',message:'未配置分类测试'})
  await expect(createInquiryService(db).submit(input)).rejects.toMatchObject({code:'INVALID_INPUT',fields:[{path:'category'}]})
  expect(await db.select().from(customerInquiries)).toHaveLength(0)
 }finally{await updateInquirySettings(db,root,meta(),{version:saved.version,settings:original.settings},false)}
})

it('重试提交只收一单，咨询列表和详情遵循权限，跟进与状态独立', async () => {
    const db = client.database
    const service = createInquiryService(db)
    const navigation = (await createMenuService(db).navigation(root)).items
    const directory = navigation.find(item => item.code === 'inquiries_center')
    expect(directory).toMatchObject({name: '客户咨询', parentId: null})
    expect(navigation.filter(item => item.parentId === directory?.id).map(({name, path}) => ({name, path}))).toEqual([
        {name: '咨询列表', path: '/admin/inquiries'}, {name: '咨询类型', path: '/admin/inquiry-settings'},
        {name: '邮件设置', path: '/admin/inquiry-mail-settings'},
    ])
    const input = inquirySubmissionSchema.parse({submissionKey: randomUUID(), locale: 'fr', category: 'export',
        name: 'Customer', email: 'customer@example.com', country: '', company: '', message: 'Need product details'})
    const [submission, retry] = await Promise.all([service.submit(input), service.submit(input)])
    expect(retry).toEqual(submission)
    const {id} = submission
    await expect(service.submit({...input, message: 'Different content'})).rejects.toMatchObject({code: 'CONFLICT'})
    const list = await service.list(reader, inquiryListSchema.parse({status: 'pending', category: 'export'}))
    expect(list.total).toBe(1)
    expect(list.items[0]).toMatchObject({id, status: 'pending'})
    expect(list.items[0]).not.toHaveProperty('email')
    expect((await service.get(reader, id)).assignees).toEqual([])
    await expect(service.update(reader, meta(), id, {action: 'note', version: 1, note: 'Denied'})).rejects.toMatchObject({code: 'FORBIDDEN'})
    expect((await service.get(root, id)).assignees.map(user => user.id)).toContain(String(handler))
    await expect(service.update(handler, meta(), id, {action: 'update', version: 1, status: 'in_progress', assigneeId: String(root)})).rejects.toMatchObject({code: 'FORBIDDEN'})
    await expect(service.update(root, meta(), id, {action: 'update', version: 1, status: 'in_progress', assigneeId: String(reader)})).rejects.toMatchObject({code: 'INVALID_INPUT'})
    const claimed = await service.update(handler, meta(), id, {action: 'update', version: 1, status: 'in_progress', assigneeId: String(handler)})
    expect(claimed.inquiry).toMatchObject({id, status: 'in_progress', assigneeId: String(handler), version: 2})
    await expect(service.update(root, meta(), id, {action: 'update', version: 1, status: 'in_progress', assigneeId: String(root)})).rejects.toMatchObject({code: 'CONFLICT', reason: 'STALE'})
    const replied = await service.update(handler, meta(), id, {action: 'external_reply', version: 2, note: 'Replied via team mailbox'})
    expect(replied.inquiry.status).toBe('in_progress')
    expect(replied.history[0]).toMatchObject({action: 'external_reply', actorName: 'Handler', note: 'Replied via team mailbox'})
    const closed = await service.update(handler, meta(), id, {action: 'update', version: 3, status: 'completed', assigneeId: String(handler)})
    expect(closed.inquiry.status).toBe('completed')
    expect(closed.history).toHaveLength(3)
    const logs = JSON.stringify((await db.select({name: adminOperationLogs.targetName, changes: adminOperationLogs.changeContext}).from(adminOperationLogs)))
    expect(logs).not.toMatch(/customer@example.com|Need product details|Replied via team mailbox/)
})

it('通过 HTTP 验证输入校验、成功提交及来源限流', async () => {
    const app = createApp(), router = createRouter()
    router.post('/api/public/inquiries', publicInquiryHandler(client.database, {origin: 'http://localhost', secureCookie: false}))
    app.use(router)
    const server = createServer(toNodeListener(app))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
        const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
        const post = (path: string, body: object, fakeIp = '192.0.2.1') => fetch(base + path, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'X-Real-IP': fakeIp}, body: JSON.stringify(body),
        })
        const path = '/api/public/inquiries'
        expect((await post(path, {})).status).toBe(400)
        const success = await post(path, {submissionKey: randomUUID(), locale: 'zh', category: 'other',
            name: '测试客户', email: 'fixture@example.com', company: '', country: '', message: '测试咨询'})
        expect(success.status).toBe(200)
        expect(await success.json()).toMatchObject({success: true, data: {id: expect.stringMatching(/^\d{19}$/)}})
        for (let i = 2; i < 8; i++) expect((await post(path, {})).status).toBe(400)
        const limited = await post(path, {}, '192.0.2.2')
        expect(limited.status).toBe(429)
        expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0)
    } finally {
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
})

it('类型调整即时生效，停用类型仍可筛选，历史引用阻止删除', async () => {
    const db = client.database
    const {version, settings, forwardTemplateDefaults} = await getInquirySettings(db, root, false)
    expect(forwardTemplateDefaults).toEqual(settings.mail.forwardTemplates)
    expect(forwardTemplateDefaults.details.body).toContain(String.fromCharCode(10))
    await expect(getInquirySettings(db, handler, false)).rejects.toMatchObject({code: 'FORBIDDEN'})
    const added = {code: 'project', labels: {zh:'项目', en:'Project', fr:'Projet', es:'Proyecto', pt:'Projeto'}, enabled: true, forwardTo: '', defaultAssigneeId: ''}
    const saved = await updateInquirySettings(db, root, meta(), inquirySettingsUpdateSchema.parse({version,
        settings: {...settings, categories: [added, ...settings.categories.map(row => ({...row, enabled: row.code !== 'export'}))]}}), false)
    expect((await publicInquiryCategories(db, 'fr')).map(item => item.code)).toEqual(['project', 'investment', 'other'])
    expect((await publicInquiryCategories(db, 'fr'))[0]?.label).toBe('Projet')
    await expect(updateInquirySettings(db, root, meta(), {version, settings}, false)).rejects.toMatchObject({reason: 'STALE'})
    const service = createInquiryService(db)
    const input = inquirySubmissionSchema.parse({submissionKey: randomUUID(), locale:'zh', category:'export',
        name:'客户', email:'fixture@example.com', company:'', country:'', message:'测试'})
    await expect(service.submit(input)).rejects.toMatchObject({code:'INVALID_INPUT', fields:[{path:'category'}]})
    expect((await service.list(reader, inquiryListSchema.parse({category:'export'}))).total).toBe(1)
    await expect(updateInquirySettings(db, root, meta(), {version:saved.version,
        settings:{...saved.settings, categories:saved.settings.categories.filter(item => item.code !== 'export')}}, false))
        .rejects.toMatchObject({code:'INVALID_INPUT', fields:[{path:'categories'}]})
    const removed = await updateInquirySettings(db, root, meta(), {version:saved.version,
        settings:{...saved.settings, categories:saved.settings.categories.filter(item => item.code !== 'project')}}, false)
    expect(removed.settings.categories.some(item => item.code === 'project')).toBe(false)
})

it('转发与后台回复独立配置，邮件可靠入队并保留投递结果', async () => {
    const db = client.database, service = createInquiryService(db, true)
    const initial = await getInquirySettings(db, root, true)
    const mail = {...initial.settings.mail, forwardEnabled: true, replyEnabled: false, from:'site@example.com',
        defaultRecipient:'team@example.com', replyMailbox:'reply@example.com',
        forwardTemplates: {...initial.settings.mail.forwardTemplates,
            details:{subject:'新询盘 {{id}} · {{category}}', body:'{{name}} 的留言：{{message}}\n查看 {{link}}'}},
    }
    const settings = {...initial.settings, mail, categories: initial.settings.categories.map(item =>
        item.code === 'other' ? {...item, forwardTo:'special@example.com'} : item)}
    await expect(updateInquirySettings(db, root, meta(), {version:initial.version, settings}, false)).rejects.toMatchObject({code:'INVALID_INPUT'})
    const enabled = await updateInquirySettings(db, root, meta(), {version:initial.version, settings}, true)
    const input = inquirySubmissionSchema.parse({submissionKey:randomUUID(), locale:'en', category:'other', name:'Customer',
        email:'customer@example.com', country:'', company:'', message:'Message for the team'})
    const {id} = await service.submit(input)
    expect(await service.submit(input)).toEqual({id})
    const first = await service.get(handler, id)
    expect(first.mail).toHaveLength(1)
    expect(first.mail[0]).toMatchObject({kind:'forward', status:'queued', recipient:'special@example.com'})
    await expect(service.update(root, meta(), id, {action:'mail_reply',version:1,body:'Reply'})).rejects.toMatchObject({code:'INVALID_INPUT'})
    let now = Date.now() + 1000
    const clock = () => new Date(now)
    const sent: InquiryEnvelope[] = []
    expect(await deliverInquiryMail(db, async envelope => {
        sent.push(envelope)
        return 'retry'
    }, clock)).toBe(true)
    expect(sent[0]).toMatchObject({sender:'site@example.com', recipient:'special@example.com', replyTo:'customer@example.com'})
    expect(sent[0]?.subject).toBe('新询盘 ' + id + ' · 其他')
    expect(sent[0]?.body).toContain('Customer 的留言：Message for the team')
    expect(await deliverInquiryMail(db, async () => 'sent', clock)).toBe(false)
    now += 60_000
    expect(await deliverInquiryMail(db, async () => 'sent', clock)).toBe(true)
    const replyOnly = await updateInquirySettings(db, root, meta(), {version:enabled.version,
        settings:{...settings,mail:{...mail,forwardEnabled:false,replyEnabled:true}}}, true)
    expect(replyOnly.settings.mail.forwardEnabled).toBe(false)
    await expect(service.update(handler, meta(), id, {action:'mail_reply',version:1,body:'Reply'})).rejects.toMatchObject({code:'FORBIDDEN'})
    const reply = await service.update(root, meta(), id, {action:'mail_reply',version:1,body:'Reply from the team'})
    expect(reply.inquiry.status).toBe('pending')
    expect(reply.mail[0]).toMatchObject({kind:'reply', recipient:'customer@example.com', body:'Reply from the team'})
    await deliverInquiryMail(db, async envelope => {
        sent.push(envelope)
        return 'failed'
    }, clock)
    expect(sent[1]).toMatchObject({recipient:'customer@example.com', replyTo:'reply@example.com'})
    const failed = (await service.get(handler, id)).mail[0]!
    expect(failed.status).toBe('failed')
    await service.update(root, meta(), id, {action:'mail_retry',version:2,deliveryId:failed.id})
    await deliverInquiryMail(db, async () => 'sent', clock)
    const complete = await service.get(handler, id)
    expect(complete.mail.map(item => item.status)).toEqual(['sent','sent'])
    expect(complete.inquiry.status).toBe('pending')
})

it('简短通知不泄露客户资料，分派与回信规则按当前设置选择', async () => {
    const db = client.database
    const service = createInquiryService(db, true, 'https://site.example.com')
    await db.update(adminUsers).set({email:'handler@example.com'}).where(eq(adminUsers.id, handler))
    const initial = await getInquirySettings(db, root, true)
    expect(inquirySettingsUpdateSchema.safeParse({version:initial.version, settings:{...initial.settings, mail:{
        ...initial.settings.mail, forwardTemplates:{...initial.settings.mail.forwardTemplates,
            notice:{subject:'新咨询', body:'客户邮箱 {{email}}'}},
    }}}).success).toBe(false)
    await updateInquirySettings(db, root, meta(), inquirySettingsUpdateSchema.parse({
        version: initial.version,
        settings: {
            categories: initial.settings.categories.map(item => item.code === 'other' ? {...item, defaultAssigneeId: String(handler)} : item),
            mail: {...initial.settings.mail, forwardEnabled:true, replyEnabled:true, forwardRoute:'default', forwardContent:'notice', replyRoute:'assignee'},
        },
    }), true)
    const input = inquirySubmissionSchema.parse({submissionKey:randomUUID(), locale:'en', category:'other', name:'Private Customer',
        email:'private@example.com', company:'Private company', country:'Private country', message:'Private details'})
    const {id} = await service.submit(input)
    expect((await service.get(root,id)).inquiry.assigneeId).toBe(String(handler))
    const envelopes: InquiryEnvelope[] = []
    const send = async (envelope: InquiryEnvelope) => {envelopes.push(envelope); return 'sent' as const}
    await deliverInquiryMail(db, send)
    expect(envelopes[0]).toMatchObject({recipient:'team@example.com', replyTo:'team@example.com'})
    expect(envelopes[0]?.body).toContain('https://site.example.com/admin/inquiries?id=' + id)
    expect(JSON.stringify(envelopes[0]?.body)).not.toMatch(/Private|private@example.com/)
    await service.update(root, meta(), id, {action:'mail_reply', version:1, body:'First reply'})
    await service.update(root, meta(), id, {action:'update', version:2, assigneeId:String(root), status:'pending'})
    await service.update(root, meta(), id, {action:'mail_reply', version:3, body:'Second reply'})
    await deliverInquiryMail(db, send)
    await deliverInquiryMail(db, send)
    expect(envelopes.slice(1).map(message => message.replyTo)).toEqual(['handler@example.com', 'special@example.com'])
})

it('按工作队列和条件检索，并去重自动分派通知、记录转派提醒投递异常', async () => {
    const db = client.database
    const service = createInquiryService(db, true, 'https://site.example.com')
    await db.update(adminUsers).set({email:'lead@example.com'}).where(eq(adminUsers.id, root))
    const initial = await getInquirySettings(db, root, true)
    const enabled = await updateInquirySettings(db, root, meta(), {version: initial.version,
        settings: {...initial.settings, mail: {...initial.settings.mail, assignmentEnabled:true, forwardEnabled:true,
            defaultRecipient:'HANDLER@example.com', forwardRoute:'default'}}}, true)
    const input = inquirySubmissionSchema.parse({submissionKey: randomUUID(), locale:'zh', category:'other',
        name:'Queue check', email:'queue-test@example.com', company:'', country:'', message:'Customer content'})
    const {id} = await service.submit(input)
    expect(await service.submit(input)).toEqual({id})
    const first = await service.get(root, id)
    expect(first.mail.map(row => row.kind)).toEqual(['forward'])
    const today = beijingDate(new Date(first.inquiry.createdAt))
    const query = (values: Record<string,string>) => inquiryListSchema.parse(values)
    expect((await service.list(handler, query({queue:'mine', search:'queue-test', from:today, to:today}))).items.map(row => row.id)).toEqual([id])
    const assigned = await service.list(root, query({assigneeId:String(handler), search:id}))
    expect(assigned.total).toBe(1)
    expect(assigned.items[0]).toMatchObject({id, deliveryIssue:false})
    expect((await service.list(root, query({queue:'unassigned', search:id}))).total).toBe(0)
    expect((await service.list(root, query({search:id, to:'2000-01-01'}))).total).toBe(0)
    await deliverInquiryMail(db, async () => 'sent')
    await updateInquirySettings(db, root, meta(), {version:enabled.version, settings:{...enabled.settings,
        mail:{...enabled.settings.mail, forwardEnabled:false}}}, true)
    await service.update(root, meta(), id, {action:'update', version:1, status:'pending', assigneeId:String(root)})
    expect((await service.get(root,id)).mail[0]).toMatchObject({kind:'assignment',recipient:'lead@example.com'})
    await deliverInquiryMail(db, async envelope => {
        expect(envelope.body).toContain('https://site.example.com/admin/inquiries?id=' + id)
        expect(envelope.body).not.toContain('Customer content')
        return 'uncertain'
    })
    expect((await service.list(root, query({queue:'delivery_issue', search:id}))).items[0]).toMatchObject({id,deliveryIssue:true})
    const delivery = (await service.get(root,id)).mail[0]!
    const closure = {action:'mail_close', version:2, deliveryId:delivery.id, reason:'已通过其他方式跟进'} as const
    await expect(service.update(handler, meta(), id, closure)).rejects.toMatchObject({code:'FORBIDDEN'})
    const closed = await service.update(root, meta(), id, closure)
    expect(closed.inquiry).toMatchObject({status:'pending',deliveryIssue:false})
    expect(closed.mail[0]).toMatchObject({status:'uncertain',resolution:{reason:closure.reason,actorId:String(root)}})
    expect((await service.list(root, query({queue:'delivery_issue', search:id}))).total).toBe(0)
    expect((await service.list(root, query({search:id}))).items[0]).toMatchObject({id,deliveryIssue:false})
    await expect(service.update(root, meta(), id, {...closure, version:3})).rejects.toMatchObject({code:'CONFLICT'})
    const next = await service.submit({...input, submissionKey:randomUUID(), category:'investment'})
    expect((await service.list(root, query({search:next.id}))).items[0]).toMatchObject({id:next.id, deliveryIssue:false})
    expect((await service.list(root, query({queue:'unassigned', search:next.id}))).total).toBe(1)
    await service.update(handler, meta(), next.id, {action:'update', version:1, status:'in_progress', assigneeId:String(handler)})
    expect((await service.get(root,next.id)).mail).toHaveLength(0)
})

it('按最近跟进排序，且只有本轮已确认的回复才能切到等待客户', async () => {
    const db = client.database, service = createInquiryService(db, true)
    const initial = await getInquirySettings(db, root, true)
    await updateInquirySettings(db, root, meta(), {version:initial.version, settings:{...initial.settings,
        mail:{...initial.settings.mail, forwardEnabled:false, assignmentEnabled:false, replyEnabled:true},
        categories:initial.settings.categories.map(item => item.code === 'investment' ? {...item, defaultAssigneeId:String(root)} : item),
    }}, true)
    const input = inquirySubmissionSchema.parse({submissionKey:randomUUID(), locale:'zh', category:'investment',
        name:'Workflow check', email:'workflow@example.com', company:'', country:'', message:'Test message'})
    const earlier = await service.submit(input)
    const later = await service.submit({...input, submissionKey:randomUUID()})
    await db.update(customerInquiries).set({createdAt:new Date('2026-01-01T00:00:00Z')}).where(eq(customerInquiries.id,BigInt(earlier.id)))
    await db.update(customerInquiries).set({createdAt:new Date('2026-01-02T00:00:00Z')}).where(eq(customerInquiries.id,BigInt(later.id)))
    const queue = inquiryListSchema.parse({queue:'mine_reply', search:'workflow@example.com'})
    const ids = async () => (await service.list(root, queue)).items.map(item => item.id)
    expect(await ids()).toEqual([earlier.id, later.id])
    const setStatus = (version: number, status: 'awaiting_reply' | 'waiting_customer') =>
        service.update(root, meta(), earlier.id, {action:'update', version, status, assigneeId:String(root)})
    const queued = await service.update(root, meta(), earlier.id, {action:'mail_reply', version:1, body:'First answer'})
    expect(queued.inquiry).toMatchObject({status:'pending', canWaitForCustomer:false, lastFollowUpAt:null})
    await expect(setStatus(2,'waiting_customer')).rejects.toMatchObject({code:'INVALID_INPUT'})
    await deliverInquiryMail(db, async () => 'sent')
    expect(await ids()).toEqual([later.id, earlier.id])
    expect((await service.get(root,earlier.id)).inquiry.canWaitForCustomer).toBe(true)
    expect((await setStatus(2,'waiting_customer')).inquiry.status).toBe('waiting_customer')
    expect(await ids()).toEqual([later.id])
    expect((await setStatus(3,'awaiting_reply')).inquiry.canWaitForCustomer).toBe(false)
    await expect(setStatus(4,'waiting_customer')).rejects.toMatchObject({code:'INVALID_INPUT'})
    await service.update(root, meta(), earlier.id, {action:'mail_reply', version:4, body:'New answer'})
    await deliverInquiryMail(db, async () => 'sent')
    expect((await setStatus(5,'waiting_customer')).inquiry.status).toBe('waiting_customer')
    expect((await setStatus(6,'awaiting_reply')).inquiry.canWaitForCustomer).toBe(false)
    const recorded = await service.update(root, meta(), earlier.id, {action:'external_reply', version:7, note:'已从工作邮箱回复本轮消息'})
    expect(recorded.inquiry.canWaitForCustomer).toBe(true)
    expect((await setStatus(8,'waiting_customer')).inquiry.status).toBe('waiting_customer')
})
