// 将后台审计变更值格式化为展示摘要，不读取业务数据或执行写入。
import {logChangeFields} from '../../config/admin/log-changes'
import type {LogChangeContext, LogChangeValue} from '../../types/admin/log-changes'

export function logChangeValueText(value: LogChangeValue): string {
    if (value === null) return '未设置'
    if (Array.isArray(value)) return value.length ? value.map(item => `${item.name}（${item.id}）`).join('、') : '无'
    if (typeof value === 'boolean') return value ? '是' : '否'
    return String(value)
}

export function logChangeSummary(context: LogChangeContext | null | undefined): string {
    if (!context) return ''
    if (!context.fields.length) return '无业务字段变化'
    const prefix = context.mode === 'create' ? '新增：' : context.mode === 'delete' ? '删除：' : '修改：'
    return prefix + context.fields.slice(0, 3).map(item => logChangeFields[item.field]).join('、') + (context.fields.length > 3 ? `等 ${context.fields.length} 项` : '')
}

export function logChangeSetDifference(before: LogChangeValue, after: LogChangeValue) {
    if (!Array.isArray(before) || !Array.isArray(after)) return null
    return {
        added: after.filter(item => !before.some(previous => previous.id === item.id)),
        removed: before.filter(item => !after.some(next => next.id === item.id)),
    }
}
