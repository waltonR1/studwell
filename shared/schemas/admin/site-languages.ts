// 独立语言维护的保存与发布输入，发布和回滚共用版本检查。
import {z} from 'zod'
import {entityVersionSchema, entityIdSchema} from '../entity'
import {siteLanguagesSchema} from '../site-languages'

export const siteLanguageSaveSchema = z.strictObject({version: entityVersionSchema, languages: siteLanguagesSchema})
export const siteLanguagePublishSchema = z.strictObject({
    version: entityVersionSchema,
    publishedReleaseId: entityIdSchema.nullable(),
    releaseId: entityIdSchema.optional()
})
