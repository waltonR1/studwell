// 后台官网资源的键、版本、发布、恢复及模板维护输入边界。
import {z} from 'zod'
import {entityIdSchema, entityVersionSchema} from '../entity'

export const websiteResourceKeySchema = z.string().regex(/^(site\.(basic|header|footer)|page\.[a-z][a-z0-9_-]{0,63})$/)
export const websitePublishSchema = z.strictObject({
    version: entityVersionSchema,
    stateVersion: entityVersionSchema,
    publishedReleaseId: entityIdSchema.nullable()
})
export const websiteRestoreSchema = websitePublishSchema.extend({releaseId: entityIdSchema})

export const websiteWithdrawSchema = websitePublishSchema
