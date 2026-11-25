// 官网公开接口统一语言和路径参数；新闻列表独立校验分页及筛选。
import {z} from 'zod'
import {supportedLocales as siteLocales} from '../../config/site-languages'

export const publicLocaleSchema = z.enum(siteLocales)
export const publicCodeSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)
export const publicLocalizedQuerySchema = z.strictObject({locale: publicLocaleSchema.optional()})
export const publicPageParamsSchema = z.strictObject({key: publicCodeSchema})
export const publicNewsParamsSchema = z.strictObject({slug: publicCodeSchema})

// HTTP 查询只接受单个十进制字符串，避免 coerce 接受空串、数组或指数。
const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
export const publicNewsListQuerySchema = z.strictObject({
    locale: publicLocaleSchema.optional(),
    page: positiveInteger.pipe(z.number().max(100000)).default(1),
    pageSize: positiveInteger.pipe(z.number().max(100)).default(12),
    category: publicCodeSchema.optional(),
    featured: z.enum(['true', 'false']).transform(value => value === 'true').default(false),
})

export type PublicLocale = z.output<typeof publicLocaleSchema>
export type PublicLocalizedQuery = z.output<typeof publicLocalizedQuerySchema>
export type PublicNewsListQueryInput = z.input<typeof publicNewsListQuerySchema>
export type PublicNewsListQuery = Omit<z.output<typeof publicNewsListQuerySchema>, 'locale'> & { locale: PublicLocale }
