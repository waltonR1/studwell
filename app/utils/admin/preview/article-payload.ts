import {localizedSchema} from '#shared/schemas/localized'
import {z} from 'zod'
import {imagePresentationSchema} from '#shared/schemas/image-presentation'
import {siteLocales} from '#shared/schemas/admin/site-settings'
import {newsContentSchema,newsTranslationSchema,newsBlockSchema} from '#shared/schemas/admin/news'

const editableTranslation=newsTranslationSchema.extend({
 sourceUrl:z.string().max(2000),
 body:z.array(z.union([
  newsBlockSchema,
  z.strictObject({type:z.enum(['heading','paragraph']),text:z.string().max(20000)}),
  z.strictObject({type:z.literal('image'),image:z.strictObject({mediaId:z.literal(''),alt:z.string().max(500),presentation:imagePresentationSchema().optional()}),caption:z.string().max(1000)}),
 ])).max(300),
})
export const articlePreviewPayload=z.strictObject({locale:z.enum(siteLocales),content:newsContentSchema.extend({
 categoryId:z.string(),displayDate:z.string().max(20),
 localized:localizedSchema(editableTranslation),
})})
