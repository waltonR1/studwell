import {localizedSchema} from '../localized'
// 后台页面装配、区块保存及并发版本校验；实际字段形状由数据库模板决定。
import {websitePageSettingsSchema} from '../website/page-settings'
import {z} from 'zod'
import {entityIdSchema, entityVersionSchema} from '../entity'
import {imagePresentationSchema} from '../image-presentation'

const key = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)
export const websiteSectionPlacementSchema = z.strictObject({
    id: z.string().regex(/^(\d{19}|new_[a-zA-Z0-9_-]{1,64})$/),
    templateId: entityIdSchema,
    templateKey: z.string().max(100),
    name: z.string().trim().min(1).max(100).optional(),
    sortOrder: z.number().int().min(0).max(10000),
    visible: z.boolean(),
    anchorKey: key,
    contentVersion: entityVersionSchema,
    structureVersion: entityVersionSchema
})
export const websitePageUpdateSchema = z.strictObject({
    version: entityVersionSchema,
    settings: websitePageSettingsSchema,
    sections: z.array(websiteSectionPlacementSchema).max(100),
    removed: z.array(z.strictObject({id: entityIdSchema, contentVersion: entityVersionSchema})).max(100)
})
const websiteSectionContentUpdateSchema = z.strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    contentVersion: entityVersionSchema,
    structureVersion: entityVersionSchema,
    shared: z.strictObject({
        media: z.array(z.strictObject({
            key: z.string().max(100),
            name: z.string().max(200),
            mediaId: entityIdSchema.nullable(),
            presentation: imagePresentationSchema().optional()
        })).max(100)
    }),
    localized: localizedSchema(z.unknown())
})
export const websiteTemplateUpdateSchema = z.strictObject({
    coverMediaId: entityIdSchema.nullable(),
    version: entityVersionSchema,
    name: z.string().trim().min(1).max(100),
    description: z.string().max(1000),
    enabledForNew: z.boolean()
})
export const websiteTemplateDeleteSchema = z.strictObject({version: entityVersionSchema})
export type WebsitePageUpdate = z.infer<typeof websitePageUpdateSchema>
export type WebsiteSectionUpdate = z.infer<typeof websiteSectionUpdateSchema>
export const websiteSectionUpdateSchema = websiteSectionContentUpdateSchema
export const websitePageDeleteSchema = z.strictObject({
    resourceId: entityIdSchema.nullable(),
    version: entityVersionSchema,
    stateVersion: entityVersionSchema,
    publishedReleaseId: z.null(),
    confirmation: key
})
export type WebsitePageDelete = z.infer<typeof websitePageDeleteSchema>
