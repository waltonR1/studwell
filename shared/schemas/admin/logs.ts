// 后台日志筛选与导出的共享输入契约；审计上下文校验位于 server/schemas/log-context.ts。
import {entityIdSchema} from '../entity'
import {z} from 'zod'
import {logResultCodes} from '../../config/admin/logs'

const date = z.string().regex(/^(19|20)\d{2}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, '日期无效')
const id = entityIdSchema
export const logFilterSchema = z.strictObject({
    period: z.enum(['today', '7d', '30d', 'custom']).default('7d'),
    startDate: date.optional(),
    endDate: date.optional(),
    requestId: z.uuid().optional(),
    logId: id.optional(),
    account: z.string().trim().regex(/^[a-z0-9_]{1,64}$/).optional(),
    actorId: id.optional(),
    action: z.string().regex(/^[a-z][a-z0-9_.]{0,39}$/).optional(),
    result: z.enum(logResultCodes).optional(),
    ip: z.union([z.ipv4(), z.ipv6(), z.literal('local'), z.literal('unknown')]).optional(),
}).superRefine((value, ctx) => {
    if (value.period === 'custom' ? !value.startDate || !value.endDate || value.startDate > value.endDate : value.startDate !== undefined || value.endDate !== undefined) ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: '自定义日期须完整且起始不晚于结束日期；预设范围不能附加日期'
    })
})
export const logExportSchema = logFilterSchema.safeExtend({includeSources: z.boolean().default(false)})
export type LogFilter = z.output<typeof logFilterSchema>
