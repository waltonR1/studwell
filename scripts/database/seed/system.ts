import {z} from 'zod'
import systemData from './data/system.json'
import {taskCodes} from '#shared/config/admin/tasks'
import {taskScheduleSchema,taskRetentionSchema} from '#shared/schemas/admin/tasks'
import {siteLanguagesSchema} from '../../../shared/schemas/site-languages'
import {defaultSiteLanguages} from '../../../shared/config/site-languages'
import {inquirySettingsSchema} from '#shared/schemas/admin/inquiry-settings'

import {sql} from 'drizzle-orm'
import type {Database, DatabaseTransaction} from '../../../server/db/transaction'
import {withEntityIds} from '../../../server/db/allocate-entity-id'
import {adminParameters, adminTasks, websiteLanguageConfig, newsOperations, customerInquirySettings, websiteSiteConfig} from '../../../server/db/schema'
import {rbacRepository} from '../../../server/repositories/rbac'
import {menuRepository} from '../../../server/repositories/menus'
import {permissionCatalog} from '../../../server/config/permissions'
import {accountRepository} from '../../../server/repositories/accounts'
import {ApiError} from '../../../server/core/errors'
import {databaseConflictReason} from '../../../server/core/db-errors'
import {resolvePasswordPolicy} from '../../../server/services/parameter-values'
import {hashPassword} from '../../../server/services/accounts/password'


// 系统初始化与专用测试数据重建共用的参数默认值。
export const parameterSeedDefaults=z.record(z.string(),z.union([z.number(),z.boolean()])).parse(systemData.parameters)


// 系统初始化与专用测试数据重建共用的任务默认值。
export const taskSeedDefaults=z.record(z.enum(taskCodes),z.object({schedule:taskScheduleSchema,retention:taskRetentionSchema.nullable(),enabled:z.boolean()})).parse(systemData.tasks)

// 当前安装包的初始站点元数据；仅供离线初始化，运行时始终读取数据库。

export const initialSiteLanguages=siteLanguagesSchema.parse(defaultSiteLanguages)

export const initialInquirySettings=inquirySettingsSchema.parse(systemData.inquirySettings)


// 离线初始化必要系统数据；所有可变默认值只补缺失项，不覆盖现有站点配置。

export async function seedSystemRows(tx: DatabaseTransaction) {
    // 仅补缺失项；重复初始化保留管理员修改、版本、发布指针和调度状态。
    const parameters=await tx.select({key:adminParameters.key}).from(adminParameters)
    const missingParameters=Object.entries(parameterSeedDefaults).filter(([key])=>!parameters.some(row=>row.key===key)).map(([key,value])=>({key,defaultValue:JSON.stringify(value)}))
    if(missingParameters.length)await tx.insert(adminParameters).values(await withEntityIds(tx,'admin_parameters',missingParameters)).onDuplicateKeyUpdate({set:{id:sql`${adminParameters.id}`}})
    const tasks=await tx.select({code:adminTasks.code}).from(adminTasks)
    const missingTasks=Object.entries(taskSeedDefaults).filter(([code])=>!tasks.some(row=>row.code===code)).map(([code,value])=>({code,...value}))
    if(missingTasks.length)await tx.insert(adminTasks).values(await withEntityIds(tx,'admin_tasks',missingTasks)).onDuplicateKeyUpdate({set:{id:sql`${adminTasks.id}`}})
    await tx.insert(newsOperations).values({id:1,viewCountEnabled:false}).onDuplicateKeyUpdate({set:{id:sql`${newsOperations.id}`}})
    await tx.insert(customerInquirySettings).values({id:1,settings:initialInquirySettings,forwardTemplateDefaults:initialInquirySettings.mail.forwardTemplates}).onDuplicateKeyUpdate({set:{id:sql`${customerInquirySettings.id}`}})
    await tx.insert(websiteSiteConfig).values({id:1,version:1,publishedReleaseId:null}).onDuplicateKeyUpdate({set:{id:sql`${websiteSiteConfig.id}`}})
    await tx.insert(websiteLanguageConfig).values({id:1,languages:initialSiteLanguages}).onDuplicateKeyUpdate({set:{id:sql`${websiteLanguageConfig.id}`}})
}

export async function seedSystemData(database: Database) {
    await database.transaction(async tx => {
        await seedSystemRows(tx)
        await rbacRepository.sync(tx, permissionCatalog)
        await menuRepository.sync(tx)
    })
}

// 离线创建首个 Root；重复运行保留已有账号与密码。
export async function seedRoot(database: Database, password?: string) {
    const existing = await accountRepository.findByUsername(database, 'root')
    if (existing) {
        if (!existing.isRoot || !existing.enabled || existing.deletedAt) throw new ApiError('CONFLICT')
        return {created: false, id: String(existing.id)}
    }
    if (!password) throw new ApiError('INVALID_INPUT')
    const passwordHash = await hashPassword(password, false, await resolvePasswordPolicy(database))
    try {
        const row = await accountRepository.insert(database, {
            username: 'root',
            displayName: 'Root',
            passwordHash,
            isRoot: true
        })
        if (!row) throw new ApiError('INTERNAL_ERROR')
        return {created: true, id: String(row.id)}
    } catch (error) {
        if (databaseConflictReason(error) !== 'DUPLICATE') throw error
        const root = await accountRepository.findByUsername(database, 'root')
        if (!root?.isRoot || !root.enabled || root.deletedAt) throw new ApiError('CONFLICT')
        return {created: false, id: String(root.id)}
    }
}
