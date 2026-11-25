// 校验持久化审计变更上下文及字段白名单。
import {z} from 'zod'
import type {LogChangeContext, LogChangeField} from '#shared/types/admin/log-changes'
import {logChangeFields} from '#shared/config/admin/log-changes'
import {auditChangeFields, type AuditChangeTarget} from '../config/audit-changes'

const reference = z.strictObject({id: z.string().min(1).max(80), name: z.string().max(160)})
const value = z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null(), z.array(reference).max(1000)])
export const logChangeContextSchema = z.strictObject({
    version: z.literal(1), mode: z.enum(['create', 'update', 'delete']),
    fields: z.array(z.strictObject({field: z.enum(Object.keys(logChangeFields) as [keyof typeof logChangeFields, ...Array<keyof typeof logChangeFields>]), before: value, after: value})).max(40),
}) satisfies z.ZodType<LogChangeContext>

export function validateAuditChanges(input: unknown, target: string): LogChangeContext {
    const context = logChangeContextSchema.parse(input)
    const allowed: readonly LogChangeField[] | undefined = Object.hasOwn(auditChangeFields, target) ? auditChangeFields[target as AuditChangeTarget] : undefined
    if (!allowed || new Set(context.fields.map(item => item.field)).size !== context.fields.length || context.fields.some(item => !allowed.includes(item.field))) throw new Error('INVALID_AUDIT_CHANGE_FIELDS')
    // 即使调用者遗漏脱敏，也拒绝将联系方式原值写入日志。
    for (const item of context.fields) {
        if ((item.field === 'email' || item.field === 'phone' || item.field === 'remark') && [item.before, item.after].some(value => value !== null && value !== '已脱敏')) throw new Error('UNSAFE_AUDIT_CHANGE_VALUE')
    }
    return context
}

export function readAuditChanges(input: unknown, target: string | null): LogChangeContext | null {
    if (!input || !target) return null
    try { return validateAuditChanges(input, target) } catch { return null }
}
