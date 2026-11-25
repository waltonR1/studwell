// 网站标识、导航、页脚草稿及更新请求的管理合同，公开接口使用独立投影。
import {localizedSchema} from '../localized'
import {z} from 'zod'
import {linkTargetSchema} from '../website/link-target'
import {entityIdSchema, entityVersionSchema} from '../entity'
import {imagePresentationSchema} from '../image-presentation'

import {supportedLocales} from '../../config/site-languages'

export const siteLocales = supportedLocales
export const siteSections = ['basic', 'header', 'footer'] as const
const text = (max: number) => z.string().trim().max(max)
const localized = (max: number) => localizedSchema(text(max))
const email = z.union([z.literal(''), z.email().max(254)])
const localizedEmail = localizedSchema(email)
const code = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/, '请选择有效的页面或栏目')
const unique = <T extends { id: string }>(items: T[]) => new Set(items.map(item => item.id)).size === items.length
export const siteLinkSchema = z.strictObject({
    id: code, label: localized(80),
    target: linkTargetSchema,
    visible: z.boolean(),
})
export const siteBasicSchema = z.strictObject({
    logoId: entityIdSchema.nullable(),
    faviconId: entityIdSchema.nullable(),
    logoPresentation: imagePresentationSchema().optional(),
    faviconPresentation: imagePresentationSchema().optional()
})
export const siteHeaderSchema = z.strictObject({
    tagline: localized(200),
    items: z.array(siteLinkSchema.extend({children: z.array(siteLinkSchema).max(30).refine(unique, '同组链接不能重复')})).max(20).refine(unique, '导航入口不能重复')
})
// 联系条目的名称及值由站点维护，不包含预设业务身份。
export const siteContactSchema = z.discriminatedUnion('kind', [
    z.strictObject({
        id: code,
        kind: z.literal('email'),
        label: localized(80),
        value: localizedEmail,
        visible: z.boolean()
    }),
    z.strictObject({
        id: code,
        kind: z.literal('phone'),
        label: localized(80),
        value: localized(50),
        visible: z.boolean()
    }),
    z.strictObject({
        id: code,
        kind: z.literal('text'),
        label: localized(80),
        value: localized(500),
        visible: z.boolean()
    }),
])
export const siteFooterSchema = z.strictObject({
    contactTarget: siteLinkSchema.shape.target.nullable(),
    contactTitle: localized(80),
    contacts: z.array(siteContactSchema).max(30).refine(unique, '联系条目标识不能重复'),
    description: localized(1000),
    copyrightHolder: localized(200),
    groups: z.array(z.strictObject({
        id: code,
        title: localized(80),
        visible: z.boolean(),
        items: z.array(siteLinkSchema).max(30).refine(unique, '同组链接不能重复')
    })).max(10).refine(unique, '分组不能重复')
})
export const siteSettingsSchema = z.strictObject({
    basic: siteBasicSchema,
    header: siteHeaderSchema,
    footer: siteFooterSchema
})
const version = z.union([z.literal(0), entityVersionSchema])
export const siteSettingsUpdateSchema = z.discriminatedUnion('section', [
    z.strictObject({section: z.literal('basic'), version, content: siteBasicSchema}),
    z.strictObject({section: z.literal('header'), version, content: siteHeaderSchema}),
    z.strictObject({section: z.literal('footer'), version, content: siteFooterSchema}),
])
export type SiteLocale = typeof siteLocales[number]
export type SiteSection = typeof siteSections[number]
export type SiteSettings = z.infer<typeof siteSettingsSchema>
export type SiteLink = z.infer<typeof siteLinkSchema>
export type SiteSettingsUpdate = z.infer<typeof siteSettingsUpdateSchema>
