import {requireSiteModule} from './site-modules'
// 协调咨询业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {adminContentLocale} from '#shared/config/site-languages'
import {resolvePublicLocale} from './site-languages'
import type {InquiryDetail, InquiryEvent, InquiryListQuery, InquirySummary, InquiryUpdate} from '#shared/schemas/admin/inquiries'
import {inquiryEmail, type InquirySubmission,type InquirySubmissionInput} from '#shared/schemas/public/inquiries'
import type {InquiryMailRecord, InquirySettings} from '#shared/schemas/admin/inquiry-settings'
import type {InquiryDetailReadResponse, InquiryDetailResponse, InquiryInbox} from '#shared/types/admin/inquiry-responses'
import {ApiError, conflictError} from '../core/errors'
import type {AuthMeta} from '../core/auth-context'
import type {Database, DatabaseExecutor} from '../db/transaction'
import {auditChanges} from '../policies/audit-changes'
import {accountRepository} from '../repositories/accounts'
import {inquiryAssign, inquiryManage, inquiryRead, inquirySend, inquiryRepository as repo, type InquiryRow} from '../repositories/inquiries'
import {assertPermission, requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'
import {readInquirySettings} from '../repositories/inquiry-settings'
import {inquiryMailRepository} from '../repositories/inquiry-mail'
import {enabledInquiryMailKinds} from './inquiry-mail'
import {renderForwardTemplate} from '#shared/utils/admin/inquiry-forward-template'

function summary(row: Pick<InquiryRow, 'id' | 'name' | 'category' | 'status' | 'assigneeId' | 'createdAt'>, assigneeName: string | null, settings: InquirySettings, deliveryIssue: boolean, lastFollowUpAt: Date | null): InquirySummary {
    return {id: String(row.id), name: row.name, category: row.category, status: row.status,
        categoryLabel: settings.categories.find(item => item.code === row.category)?.labels[adminContentLocale] ?? row.category,
        assigneeId: row.assigneeId === null ? null : String(row.assigneeId), assigneeName, createdAt: row.createdAt.toISOString(),
        lastFollowUpAt: lastFollowUpAt?.toISOString() ?? null, deliveryIssue}
}

async function detail(db: DatabaseExecutor, id: bigint, settings: InquirySettings): Promise<{inquiry: InquiryDetail; history: InquiryEvent[]; mail: InquiryMailRecord[]}> {
    const result = await repo.get(db, id)
    if (!result) throw new ApiError('NOT_FOUND')
    const {row, assigneeName, lastFollowUpAt} = result
    const history = await repo.history(db, id)
    const deliveries = await inquiryMailRepository.history(db, id)
    return {
        inquiry: {...summary(row, assigneeName, settings, deliveries.some(mail => !mail.resolution && (mail.status === 'failed' || mail.status === 'uncertain')), lastFollowUpAt), version: row.version, email: row.email, company: row.company,
            canWaitForCustomer: row.status === 'waiting_customer' || await repo.hasConfirmedReply(db, id),
            country: row.country, message: row.message, locale: row.locale},
        history: history.map(event => ({
            id: String(event.id), action: event.action, actorName: event.actorName, note: event.note,
            status: event.status, assigneeName: event.assigneeName, createdAt: event.createdAt.toISOString(),
        })),
        mail: deliveries.map(mail => ({
            id: String(mail.id), kind: mail.kind, status: mail.status, recipient: mail.recipient,
            body: mail.kind === 'reply' ? mail.body : '', attempts: mail.attempts,
            createdAt: mail.createdAt.toISOString(), sentAt: mail.sentAt?.toISOString() ?? null,
            resolution: mail.resolution,
        })),
    }
}

async function replyAddress(db: DatabaseExecutor, settings: InquirySettings, category: string, assigneeId: bigint | null) {
    const {mail} = settings
    if (mail.replyRoute === 'default') return mail.replyMailbox
    if (mail.replyRoute === 'assignee' && assigneeId !== null) {
        const [assignee] = await repo.assignees(db, assigneeId)
        const address = inquiryEmail.safeParse(assignee?.email)
        if (address.success) return address.data
    }
    return settings.categories.find(item => item.code === category)?.forwardTo || mail.replyMailbox
}

export function createInquiryService(db: Database, transportConfigured = false, adminOrigin = '') {
    const detailLink = (id: bigint) => adminOrigin.replace(/\/$/, '') + '/admin/inquiries?id=' + id
    async function notifyAssignee(tx: DatabaseExecutor, row: InquiryRow, mail: InquirySettings['mail'], email: string | null, alsoSentTo?: string) {
        if (!mail.assignmentEnabled) return
        const address = inquiryEmail.safeParse(email)
        if (!address.success || address.data.toLowerCase() === alsoSentTo?.toLowerCase()) return
        await inquiryMailRepository.enqueue(tx, {
            inquiryId: row.id, kind: 'assignment', sender: mail.from, recipient: address.data, replyTo: mail.from,
            subject: '咨询已分派给你 [' + row.id + ']',
            body: ['有一条官网咨询已分派给你。', '咨询编号：' + row.id, '', '在后台查看：' + detailLink(row.id)].join('\n'),
        })
    }
    return {
        async submit(raw: InquirySubmissionInput) {
            return db.transaction(async tx => {
                await requireSiteModule(tx,'inquiries')
                const input:InquirySubmission={...raw,locale:await resolvePublicLocale(tx,raw.locale)}
                const {settings} = await readInquirySettings(tx, 'share')
                const {stored: row, inserted} = await repo.submit(tx, input)
                if (Object.entries(input).some(([key, value]) => row[key as keyof InquirySubmission] !== value)) {
                    throw new ApiError('CONFLICT')
                }
                if (inserted) {
                    const category = settings.categories.find(item => item.code === input.category && item.enabled)
                    if (!category) throw new ApiError('INVALID_INPUT', [{path: 'category', message: '该咨询类型已不可用，请重新选择。'}])
                    const assignee = category.defaultAssigneeId
                        ? (await repo.assignees(tx, BigInt(category.defaultAssigneeId)))[0] : undefined
                    if (assignee) await repo.update(tx, row.id, {assigneeId: assignee.id, status: row.status, version: row.version})
                    const {mail} = settings
                    const recipient = (mail.forwardRoute === 'category' && category.forwardTo) || mail.defaultRecipient
                    if (mail.forwardEnabled) {
                        const template = mail.forwardTemplates[mail.forwardContent]
                        const heading = {id: String(row.id), category: category.labels[adminContentLocale]??category.code}
                        const notice = {...heading, link: detailLink(row.id)}
                        const values = mail.forwardContent === 'notice' ? notice : {...notice, name: row.name, email: row.email,
                            company: row.company || '—', country: row.country || '—', locale: row.locale, message: row.message}
                        await inquiryMailRepository.enqueue(tx, {
                            inquiryId: row.id, kind: 'forward', sender: mail.from, recipient,
                            replyTo: mail.forwardContent === 'notice' ? recipient : row.email,
                            subject: renderForwardTemplate(template.subject, heading),
                            body: renderForwardTemplate(template.body, values),
                        })
                    }
                    if (assignee) await notifyAssignee(tx, row, mail, assignee.email, mail.forwardEnabled ? recipient : undefined)
                }
                return {id: String(row.id)}
            }, {isolationLevel: 'read committed'})
        },
        async list(actor: bigint, query: InquiryListQuery): Promise<InquiryInbox> {
            return db.transaction(async tx => {
                await requirePermission(tx, actor, inquiryRead)
                const {settings} = await readInquirySettings(tx)
                const {rows, total} = await repo.list(tx, query, actor)
                const assignees = (await repo.assigneeFilters(tx)).map(user => ({id: String(user.id), name: user.name}))
                return {items: rows.map(row => summary(row, row.assigneeName, settings, row.deliveryIssue, row.lastFollowUpAt)), total, page: query.page, pageSize: query.pageSize, assignees,
                    categories: settings.categories.map(item => ({code: item.code, label: item.labels[adminContentLocale]??item.code, enabled: item.enabled}))}
            }, {isolationLevel: 'repeatable read'})
        },
        async get(actor: bigint, id: string): Promise<InquiryDetailReadResponse> {
            return db.transaction(async tx => {
                const access = await requirePermission(tx, actor, inquiryRead)
                const {settings} = await readInquirySettings(tx)
                const result = await detail(tx, BigInt(id), settings)
                const assignees = access.permissions.includes(inquiryAssign) ? await repo.assignees(tx) : []
                const mailKinds = transportConfigured && access.permissions.includes(inquirySend) ? enabledInquiryMailKinds(settings.mail) : []
                return {...result, assignees: assignees.map(user => ({id: String(user.id), name: user.name})),
                    mailKinds, replyAddress: mailKinds.includes('reply') ? await replyAddress(tx, settings, result.inquiry.category,
                        result.inquiry.assigneeId ? BigInt(result.inquiry.assigneeId) : null) : ''}
            }, {isolationLevel: 'repeatable read'})
        },
        async update(actor: bigint, meta: AuthMeta, id: string, input: InquiryUpdate): Promise<InquiryDetailResponse> {
            return auditedWrite(db, {actor, meta, id, targetType: 'inquiry', action: 'inquiry.' + input.action,
                isolationLevel: 'read committed'}, async tx => {
                const access = await requirePermission(tx, actor, inquiryRead)
                if (input.action === 'mail_reply' || input.action === 'mail_retry' || input.action === 'mail_close') assertPermission(access, inquirySend)
                else if (input.action !== 'update') assertPermission(access, inquiryManage)
                const {settings} = await readInquirySettings(tx, 'share')
                const row = await repo.lock(tx, BigInt(id))
                if (!row) throw new ApiError('NOT_FOUND')
                if (row.version !== input.version) throw conflictError('STALE', 'version')
                const actorName = (await accountRepository.findById(tx, actor))!.displayName
                let {status, assigneeId} = row
                let assigneeName: string | null = null
                if (input.action === 'update') {
                    status = input.status
                    assigneeId = input.assigneeId === null ? null : BigInt(input.assigneeId)
                    const claim = row.assigneeId === null && assigneeId === actor && (
                        (row.status === 'pending' && status === 'in_progress')
                        || (['awaiting_reply', 'in_progress', 'waiting_customer'].includes(row.status) && status === row.status)
                    )
                    if (!(claim && access.permissions.includes(inquiryManage))) {
                        if (assigneeId !== row.assigneeId) assertPermission(access, inquiryAssign)
                        if (status !== row.status) assertPermission(access, inquiryManage)
                    }
                    if (status === row.status && assigneeId === row.assigneeId) throw new ApiError('INVALID_INPUT')
                    if (status === 'waiting_customer' && status !== row.status && !await repo.hasConfirmedReply(tx, row.id))
                        throw new ApiError('INVALID_INPUT', [{path: 'status', message: '请先等回复邮件被服务器接收，或登记已经通过工作邮箱发出的回复。'}])
                    if (assigneeId !== null) {
                        const assignee = assigneeId === row.assigneeId
                            ? await accountRepository.findById(tx, assigneeId)
                            : (await repo.assignees(tx, assigneeId))[0]
                        if (!assignee) throw new ApiError('INVALID_INPUT', [{path: 'assigneeId', message: '请选择有咨询处理权限的负责人。'}])
                        assigneeName = 'displayName' in assignee ? assignee.displayName : assignee.name
                        if (assigneeId !== row.assigneeId && !claim && status !== 'spam')
                            await notifyAssignee(tx, row, settings.mail, assignee.email)
                    }
                }
                const mailKinds = transportConfigured && access.permissions.includes(inquirySend) ? enabledInquiryMailKinds(settings.mail) : []
                const replyTo = mailKinds.includes('reply') ? await replyAddress(tx, settings, row.category, assigneeId) : ''
                if (input.action === 'mail_reply') {
                    if (!mailKinds.includes('reply') || row.status === 'spam')
                        throw new ApiError('INVALID_INPUT', [{path: 'body', message: '该咨询当前不能使用后台邮件回复。'}])
                    await inquiryMailRepository.enqueue(tx, {inquiryId: row.id, kind: 'reply', sender: settings.mail.from,
                        replyCycleId: await repo.latestReplyCycle(tx, row.id),
                        recipient: row.email, replyTo, subject: 'Re: Inquiry [' + row.id + ']', body: input.body})
                }
                if (input.action === 'mail_retry' && (row.status === 'spam'
                    || !await inquiryMailRepository.retry(tx, row.id, BigInt(input.deliveryId), mailKinds, new Date())))
                    throw conflictError('STALE', 'deliveryId')
                if (input.action === 'mail_close' && !await inquiryMailRepository.closeIssue(tx, row.id, BigInt(input.deliveryId),
                    {reason: input.reason, actorId: String(actor), actorName, at: new Date().toISOString()}))
                    throw conflictError('STALE', 'deliveryId')
                await repo.update(tx, row.id, {status, assigneeId, version: row.version + 1})
                await repo.append(tx, {inquiryId: row.id, actorId: actor, actorName, action: input.action,
                    status: input.action === 'update' && status !== row.status ? status : null, assigneeName, note: 'note' in input ? input.note : ''})
                return {id, name: id, value: {...await detail(tx, row.id, settings), mailKinds, replyAddress: replyTo},
                    changes: auditChanges('inquiry', {settingsVersion: row.version}, {settingsVersion: row.version + 1})}
            })
        },
    }
}
