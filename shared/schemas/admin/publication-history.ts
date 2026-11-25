// 历史清理只接受所属对象和乐观锁；当前版本由服务端重新核对。
import {z} from 'zod'
import {entityIdSchema,entityVersionSchema} from '../entity'
import {websiteRestoreSchema,websiteResourceKeySchema} from './website'

const singleton=z.strictObject({version:entityVersionSchema,publishedReleaseId:entityIdSchema.nullable(),releaseId:entityIdSchema})
export const publicationHistoryCleanupSchema=z.discriminatedUnion('kind',[
 websiteRestoreSchema.extend({kind:z.literal('website'),key:websiteResourceKeySchema}),
 websiteRestoreSchema.extend({kind:z.literal('news'),articleId:entityIdSchema}),
 singleton.extend({kind:z.literal('routes')}),
 singleton.extend({kind:z.literal('languages')}),
])
export type PublicationHistoryCleanup=z.infer<typeof publicationHistoryCleanupSchema>
