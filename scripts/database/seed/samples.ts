import {z} from 'zod'
import sampleData from './data/samples.json'
import {supportedLocales} from '#shared/config/site-languages'
import {roleRepository} from '../../../server/repositories/roles'
import {menuRepository} from '../../../server/repositories/menus'
import {menuPageCatalog} from '../../../server/config/menus'
import {permissionCatalog} from '../../../server/config/permissions'
import {randomUUID} from 'node:crypto'
import {eq,sql} from 'drizzle-orm'
import type {Database, DatabaseTransaction} from '../../../server/db/transaction'
import {adminDictionaries,adminDictionaryItems,adminUsers, adminRoles, adminUserRoles, adminPermissions, customerInquiries, websiteResources} from '../../../server/db/schema'
import {createAccountService} from '../../../server/services/accounts'
import {auditService} from '../../../server/services/audit'
import {withEntityIds} from '../../../server/db/allocate-entity-id'
import {readInquirySettings} from '../../../server/repositories/inquiry-settings'

// 可选展示角色预设：仅创建缺失角色，不随权限目录扩展自动获得新能力。
export const rolePresets=z.array(z.object({code:z.string().min(1),name:z.string(),pageKeys:z.array(z.string()),permissions:z.array(z.string())})).parse(sampleData.roles)

export const sampleAccounts=z.array(z.object({username:z.string().min(1),displayName:z.string(),department:z.string(),position:z.string(),role:z.string().nullable(),enabled:z.boolean()})).parse(sampleData.accounts)


const sampleInquiry=z.object({submissionKey:z.uuid(),locale:z.enum(supportedLocales),name:z.string(),email:z.email(),company:z.string(),country:z.string(),message:z.string()}).parse(sampleData.inquiry)

const sampleDictionaries=z.array(z.object({code:z.string().min(1),name:z.string(),description:z.string(),items:z.array(z.tuple([z.string(),z.string()]))})).parse(sampleData.dictionaries)

async function seedSampleDictionaries(tx:DatabaseTransaction) {
    const dictionaries=await tx.select({code:adminDictionaries.code}).from(adminDictionaries)
    const missingDictionaries=sampleDictionaries.filter(preset=>!dictionaries.some(row=>row.code===preset.code)).map(preset=>({code:preset.code,name:preset.name,description:preset.description,enabled:true}))
    if(missingDictionaries.length)await tx.insert(adminDictionaries).values(await withEntityIds(tx,'admin_dictionaries',missingDictionaries)).onDuplicateKeyUpdate({set:{id:sql`${adminDictionaries.id}`}})
    for (const preset of sampleDictionaries) {
        const [dictionary] = await tx.select().from(adminDictionaries).where(eq(adminDictionaries.code, preset.code)).for('update')
        if (!dictionary) throw new Error('DB_SAMPLE_DICTIONARY_REQUIRED')
        const existing = await tx.select().from(adminDictionaryItems).where(eq(adminDictionaryItems.dictionaryId, dictionary.id))
        const missing = preset.items.flatMap(([code, name], index) => existing.some(item => item.code === code) ? [] : [{
            dictionaryId: dictionary.id, code, name, sortOrder: (index + 1) * 100,
        }])
        if (missing.length) await tx.insert(adminDictionaryItems).values(await withEntityIds(tx, 'admin_dictionary_items', missing))
    }
}

export async function seedPresets(database: Database, password?: string, executor?:DatabaseTransaction) {
    const work=async (tx:DatabaseTransaction) => {
        const [root] = await tx.select().from(adminUsers).where(eq(adminUsers.username, 'root')).for('update')
        if (!root?.isRoot || !root.enabled || root.deletedAt) throw new Error('DB_PRESETS_ROOT_REQUIRED')
        await seedSampleDictionaries(tx)
        const result = {
            roles: {created: [] as string[], skipped: [] as string[]},
            accounts: [] as string[],
            skippedAccounts: [] as string[]
        }
        const requestId = randomUUID()
        const audit = (targetType: string, targetId: bigint, targetName: string, action: string) => auditService.write(tx, {
            actorId: root.id,
            targetType,
            targetId: String(targetId),
            targetName,
            action,
            result: 'success',
            ip: 'local',
            userAgent: 'account-presets-seed',
            requestId,
            createdAt: new Date(),
        })
        result.roles = await seedPresetRoles(database, tx)
        const users = await tx.select().from(adminUsers).for('update')
        const roles = await tx.select().from(adminRoles).for('update')
        // 初始化与 Root 一致：豁免弱口令名单，保留长度校验及首次登录改密。
        const accounts = createAccountService(database, false, tx)
        for (const preset of sampleAccounts) {
            // 包括已软删除账号：不复活、不重置密码、不重新关联角色。
            if (users.some(user => user.username === preset.username)) {
                result.skippedAccounts.push(preset.username);
                continue
            }
            if (!password) throw new Error('SYSTEM_SEED_PASSWORD_REQUIRED')
            const role = preset.role ? roles.find(role => role.code === preset.role) : undefined
            if (preset.role && !role?.enabled) throw new Error('SYSTEM_SEED_ROLE_DISABLED')
            const account = await accounts.createOrdinary({
                username: preset.username,
                displayName: preset.displayName,
                department: preset.department,
                position: preset.position,
                remark: '虚构系统初始化账号；非真实员工，首次登录须修改密码。',
                password
            }, String(root.id))
            const id = BigInt(account.id)
            if (!preset.enabled) await tx.update(adminUsers).set({enabled: false}).where(eq(adminUsers.id, id))
            if (role) await tx.insert(adminUserRoles).values({userId: id, roleId: role.id})
            await audit('user', id, preset.displayName, 'users.create')
            if (role) await audit('user', id, preset.displayName, 'users.roles')
            result.accounts.push(preset.username)
        }
        return result
    }
    return executor?work(executor):database.transaction(work)
}

export async function seedPresetRoles(database: Database, executor?: DatabaseTransaction) {
    const work = async (tx: DatabaseTransaction) => {
        // Root 在首次登录前也能完成初始化；这不是 HTTP 授权入口。
        const [root] = await tx.select().from(adminUsers).where(eq(adminUsers.username, 'root')).for('update')
        if (!root?.isRoot || !root.enabled || root.deletedAt) throw new Error('ROLE_PRESETS_ROOT_REQUIRED')
        const existing = await tx.select().from(adminRoles).for('update')
        const missing = rolePresets.filter(preset => !existing.some(role => role.code === preset.code))
        const menus = await menuRepository.all(tx, true)
        const permissions = await tx.select().from(adminPermissions)
        // 所有待创建模板先校验，目录未同步/菜单缺失时整批拒绝，不创建半授权角色。
        for (const preset of missing) {
            const pages = preset.pageKeys.map(key => menuPageCatalog.find(page => page.key === key && page.available && !page.builtin))
            if (pages.some(page => !page || !menus.some(menu => menu.pageKey === page.key))) throw new Error('ROLE_PRESETS_MENU_REQUIRED')
            const bound = new Set(['system.dashboard.read', ...pages.flatMap(page => page?.operations ?? [])])
            if (preset.permissions.some(code => !bound.has(code) || !permissionCatalog.some(permission => permission.code === code && permission.available) || !permissions.some(permission => permission.code === code && permission.available))) throw new Error('ROLE_PRESETS_PERMISSION_REQUIRED')
            if (pages.some(page => !preset.permissions.some(code => code === page!.permission))) throw new Error('ROLE_PRESETS_PAGE_READ_REQUIRED')
        }
        const created: string[] = [],
            skipped = rolePresets.filter(preset => !missing.includes(preset)).map(preset => preset.code)
        const requestId = randomUUID()
        for (const preset of missing) {
            const id = await roleRepository.insert(tx, {
                code: preset.code,
                name: preset.name,
                enabled: true,
                createdBy: null,
                updatedBy: null
            })
            if (!await roleRepository.replacePermissions(tx, id, [...preset.permissions])) throw new Error('ROLE_PRESETS_PERMISSION_REQUIRED')
            await menuRepository.replace(tx, id, preset.pageKeys.flatMap(key => menus.filter(menu => menu.pageKey === key).map(menu=>menu.id)))
            await auditService.write(tx, {
                actorId: root.id,
                action: 'roles.create',
                targetType: 'role',
                targetId: String(id),
                targetName: preset.name,
                result: 'success',
                ip: 'local',
                userAgent: 'role-presets-seed',
                requestId,
                createdAt: new Date()
            })
            created.push(preset.code)
        }
        return {created, skipped}
    }
    return executor ? work(executor) : database.transaction(work)
}


// 第四阶段只补充本站声明的展示样例；不承担本站内容初始化。

export async function seedSamples(database:Database,password?:string,dryRun=false){
    const pages=await database.select({id:websiteResources.id}).from(websiteResources).where(eq(websiteResources.type,'page')).limit(1)
    if(!pages.length)throw new Error('DB_SAMPLE_SITE_REQUIRED')
    if(dryRun){
        const users=await database.select().from(adminUsers)
        const actor=users.find(user=>user.isRoot)
        if(!actor?.enabled||actor.deletedAt)throw new Error('DB_PRESETS_ROOT_REQUIRED')
        const present=await database.select({id:customerInquiries.id}).from(customerInquiries).where(eq(customerInquiries.submissionKey,sampleInquiry.submissionKey))
        const category=(await readInquirySettings(database)).settings.categories.some(item=>item.enabled)
        return {accounts:sampleAccounts.filter(account=>!users.some(user=>user.username===account.username)).map(account=>account.username),inquiries:!present.length&&category?1:0,status:'preview'}
    }
    return database.transaction(async tx=>{
        const accounts=await seedPresets(database,password,tx)
        const {submissionKey}=sampleInquiry
        let inquiries=0
        if(!(await tx.select({id:customerInquiries.id}).from(customerInquiries).where(eq(customerInquiries.submissionKey,submissionKey))).length){
            const category=(await readInquirySettings(tx)).settings.categories.find(item=>item.enabled)
            if(category){
                await tx.insert(customerInquiries).values(await withEntityIds(tx,'customer_inquiries',{...sampleInquiry,category:category.code}))
                inquiries=1
            }
        }
        return {accounts,inquiries}
    })
}
