// 参数更新、偏好查询与基础值域的输入合同；可编辑性和生效策略由后端裁决。
import {entityIdSchema, entityVersionSchema} from '../entity'
import {z} from 'zod'
import {ADMIN_PAGE_SIZES} from '../../config/admin/pagination'
import {LOG_EXPORT_HARD_LIMIT} from '../../config/admin/logs'

export const pageSizeValueSchema = z.literal(ADMIN_PAGE_SIZES)
export const logExportLimitValueSchema = z.number().int().min(100).max(LOG_EXPORT_HARD_LIMIT)
const value = z.union([z.number().int().min(1).max(86400000), z.boolean()]).nullable()
export const parameterUpdateSchema = z.strictObject({version: entityVersionSchema, value})
export const parameterBatchSchema = z.strictObject({items: z.array(parameterUpdateSchema.extend({id: entityIdSchema})).min(1).max(50).refine(items => new Set(items.map(item => item.id)).size === items.length, '参数不能重复')})
export const preferenceQuerySchema = z.strictObject({version: z.string().max(128).optional()})

export type ParameterUpdateInput = z.input<typeof parameterUpdateSchema>
export type ParameterBatchInput = z.input<typeof parameterBatchSchema>
export type PreferenceQueryInput = z.input<typeof preferenceQuerySchema>
