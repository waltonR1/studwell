// 定义已发布页面快照及媒体槽位的校验合同。
import {localizedSchema} from '#shared/schemas/localized'
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {z} from 'zod'
import {entityIdSchema} from '#shared/schemas/entity'

import {publicCodeSchema} from '#shared/schemas/public/queries'
import {imageRuleSchema,imagePresentationSchema} from '#shared/schemas/image-presentation'
export {publishedFieldDefinition} from '#shared/schemas/website/section-template'

// 发布快照保存当时的字段与槽位合同；新增模板字段不改变历史发布的读取结果。
export const publishedMediaSlotSchema = z.object({key: z.string().max(100), name: z.string().max(200), kind: z.enum(['image', 'video']), imagePreset: imageRuleSchema.optional()})
const baseSection = z.object({
  id: entityIdSchema, templateKey: z.string().min(1).max(100),
  renderer: z.string().regex(/^[a-z][a-z0-9_.-]{0,99}$/i), videoPath: z.string().min(1).nullable(),
  name: z.string().min(1),
  allowedPages: z.union([z.literal('all'), z.array(z.string().min(1))]),
  sortOrder: z.number().int().nonnegative(), anchorKey: publicCodeSchema, visible: z.boolean(),
  shared: z.object({media: z.array(z.object({key: z.string().max(100), mediaId: entityIdSchema.nullable(), presentation: imagePresentationSchema().optional()})).max(100)}),
  localized: localizedSchema(z.unknown()),
  definition: z.custom<unknown>(value => value !== undefined && value !== null), mediaSlots: z.array(publishedMediaSlotSchema).max(100),
})
export const publishedPageSnapshotSchema = z.strictObject({settings: websitePageSettingsSchema, sections: z.array(baseSection).max(100)})
export type PublishedSection = z.output<typeof baseSection>
