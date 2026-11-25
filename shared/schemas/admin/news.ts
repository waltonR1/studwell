// 新闻后台内容及生命周期操作的输入合同；语言完整性与图片规则由服务端校验。
import {localizedSchema as localized} from '../localized'
import {createLocalized} from '../../utils/localized'
import {z} from 'zod'
import {entityIdSchema, entityVersionSchema} from '../entity'
import {imagePresentationSchema} from '../image-presentation'

export const newsCodeSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)
const text = (max: number) => z.string().trim().max(max)
const image = z.strictObject({
    mediaId: entityIdSchema,
    alt: text(500),
    presentation: imagePresentationSchema().optional()
})
export const newsBlockSchema = z.discriminatedUnion('type', [
    z.strictObject({type: z.literal('heading'), text: text(500).min(1)}),
    z.strictObject({type: z.literal('paragraph'), text: text(20000).min(1)}),
    z.strictObject({type: z.literal('image'), image, caption: text(1000)}),
])
export const newsTranslationSchema = z.strictObject({
    title: text(200),
    summary: text(2000),
    body: z.array(newsBlockSchema).max(300),
    seoTitle: text(160),
    seoDescription: text(500),
    sourceName: text(200),
    sourceUrl: z.union([z.literal(''), z.url().max(2000).refine(v => /^https?:\/\//.test(v))])
})
export const newsContentSchema = z.strictObject({
    categoryId: entityIdSchema,
    displayDate: z.iso.date(),
    coverMediaId: entityIdSchema.nullable(),
    coverPresentation: imagePresentationSchema().optional(),
    featured: z.boolean(),
    featuredOrder: z.number().int().min(0).max(100000),
    localized: localized(newsTranslationSchema)
})
export const newsArticleCreateSchema = z.strictObject({slug: newsCodeSchema, content: newsContentSchema})
export const newsArticleUpdateSchema = newsArticleCreateSchema.extend({version: entityVersionSchema})
export const newsCategoryCreateSchema = z.strictObject({
    code: newsCodeSchema,
    name: localized(text(100)),
    sortOrder: z.number().int().min(0).max(100000),
    enabled: z.boolean()
})
export const newsCategoryUpdateSchema = newsCategoryCreateSchema.extend({version: entityVersionSchema})
export const newsCategorySaveSchema = z.union([
    newsCategoryCreateSchema.extend({id: z.null()}),
    newsCategoryUpdateSchema.extend({id: entityIdSchema}),
])
export const newsOperationsUpdateSchema = z.strictObject({version: entityVersionSchema, viewCountEnabled: z.boolean()})
export const newsVersionSchema = z.strictObject({version: entityVersionSchema})
export const newsCategoryMoveSchema = z.strictObject({
    version: entityVersionSchema,
    neighborId: entityIdSchema,
    neighborVersion: entityVersionSchema,
    direction: z.enum(['up', 'down'])
})
export const newsPublicationInputSchema = z.strictObject({
    version: entityVersionSchema,
    stateVersion: entityVersionSchema,
    publishedReleaseId: entityIdSchema.nullable()
})
export const newsRestoreSchema = newsPublicationInputSchema.extend({releaseId: entityIdSchema})
export const newsQuerySchema = z.strictObject({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: text(100).default(''),
    categoryId: entityIdSchema.optional(),
    status: z.enum(['all', 'published', 'offline', 'unpublished']).default('all')
})
export const newsListSectionSchema = z.strictObject({
    copy: z.strictObject({
        all: text(100).min(1),
        empty: text(500).min(1)
    }),
    data: z.strictObject({
        pageSize: z.number().int().min(1).max(100),
        showFilters: z.boolean(),
        showDate: z.boolean(),
        showSummary: z.boolean()
    })
})
export type NewsContent = z.infer<typeof newsContentSchema>
export type NewsCategoryInput = z.infer<typeof newsCategoryCreateSchema>
export type NewsArticleInput = z.infer<typeof newsArticleCreateSchema>

export function emptyNewsContent(categoryId: string): NewsContent {
    const translation = {
        title: '',
        summary: '',
        body: [],
        seoTitle: '',
        seoDescription: '',
        sourceName: '',
        sourceUrl: ''
    }
    return {
        categoryId,
        displayDate: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
        coverMediaId: null,
        featured: false,
        featuredOrder: 0,
        localized: createLocalized(() => structuredClone(translation))
    }
}
