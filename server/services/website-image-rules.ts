// 读取模块图片规则并校验基础图片展示设置。
import {parseInput} from '../core/validation'
import {imagePresentationSchema} from '#shared/schemas/image-presentation'
import type {z} from 'zod'
import type {siteBasicSchema} from '#shared/schemas/admin/site-settings'
// HTTP 通过服务授权读取模块规则，不直接访问持久化层。
import type {DatabaseExecutor} from '../db/transaction'
import {readModuleImageRules} from '../repositories/website-image-rules'
import {requirePermission} from './access/permissions'
export async function moduleImageRules(db:DatabaseExecutor,actor:bigint){await requirePermission(db,actor,'content.media.read');return readModuleImageRules(db)}

export async function assertBasicImagePresentations(db:DatabaseExecutor,value:z.infer<typeof siteBasicSchema>){
 const rules=await readModuleImageRules(db)
 await parseInput(imagePresentationSchema(rules.logo).optional(),value.logoPresentation)
 await parseInput(imagePresentationSchema(rules.favicon).optional(),value.faviconPresentation)
}
