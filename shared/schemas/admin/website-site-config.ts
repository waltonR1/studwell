// 全站语言、路由和 SEO 的后台写入、发布及恢复操作合同。
import {z} from 'zod'
import {entityIdSchema, entityVersionSchema} from '../entity'
import {siteLocales} from './site-settings'

export const siteConfigVersionSchema = z.strictObject({
    version: entityVersionSchema,
    publishedReleaseId: entityIdSchema.nullable(),
    releaseId: entityIdSchema.optional()
})
export const websiteSeoEntrySchema = z.strictObject({
    locale: z.enum(siteLocales),
    title: z.string().max(200),
    description: z.string().max(500),
    indexable: z.boolean(),
    ogTitle: z.string().max(200),
    ogDescription: z.string().max(500),
    ogMediaId: entityIdSchema.nullable()
})
export const websiteSeoUpdateSchema = z.strictObject({
    action: z.literal('seo'),
    version: entityVersionSchema,
    resourceId: entityIdSchema,
    entries: z.array(websiteSeoEntrySchema).min(1).max(siteLocales.length)
})
