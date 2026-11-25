// 纯计算：业务层传入事务内已读取的旧值和实际新值；只提取明确允许的字段。
import type {LogChangeContext, LogChangeField, LogChangeReference, LogChangeValue} from '#shared/types/admin/log-changes'

import {auditChangeFields, type AuditChangeTarget} from '../config/audit-changes'

function value(input: unknown, field: LogChangeField): LogChangeValue {
    if (input === null || input === undefined) return null
    if (typeof input === 'bigint') return String(input)
    if (Array.isArray(input)) return input.map(item => ({id: String(item.id), name: String(item.name)})).sort((a, b) => a.id.localeCompare(b.id))
    if (field === 'email' || field === 'phone' || field === 'remark') return '已脱敏'
    if (typeof input === 'string' || typeof input === 'boolean' || typeof input === 'number') return input
    throw new Error('INVALID_AUDIT_CHANGE_VALUE')
}

export function auditChanges(target: AuditChangeTarget, before: object | null, after: object | null): LogChangeContext {
    const mode = before === null ? 'create' : after === null ? 'delete' : 'update'
    const old = (before ?? {}) as Record<string, unknown>, next = (after ?? {}) as Record<string, unknown>
    const fields: LogChangeContext['fields'] = []
    for (const field of auditChangeFields[target]) {
        if (!(field in old) && !(field in next)) continue
        const previous = value(old[field], field), current = value(next[field], field)
        // 联系方式只持久化变更事实；比较原值，避免脱敏后相同而漏记。
        const same = field === 'email' || field === 'phone' || field === 'remark'
            ? (old[field] ?? null) === (next[field] ?? null)
            : JSON.stringify(previous) === JSON.stringify(current)
        if (mode === 'update' && same) continue
        fields.push({field, before: previous, after: current})
    }
    return {version: 1, mode, fields}
}

export function auditReferences(ids: readonly string[], catalog: readonly {id: string | bigint; name: string}[]): LogChangeReference[] {
    return ids.map(id => ({id, name: catalog.find(item => String(item.id) === id)?.name ?? id}))
}
