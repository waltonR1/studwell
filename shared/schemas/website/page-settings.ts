// 官网页面名称、场景设置和基础 SEO 的跨端合同。
import {localizedSchema} from '../localized'
import {z} from 'zod'

export const localizedPageText = localizedSchema(z.string().max(500))
export const websiteSeoSchema = z.strictObject({title: z.string().max(200), description: z.string().max(500)})
export const localizedWebsiteSeoSchema = localizedSchema(websiteSeoSchema)
export const websitePageSettingsSchema = z.strictObject({
    displayName: localizedPageText,
    sceneEnabled: z.boolean(),
    sceneTransitionSeconds: z.number().min(0.1).max(3).nullable()
})
export type WebsitePageSettings = z.infer<typeof websitePageSettingsSchema>
