// 将日志记录转换为 CSV 单元格和行，处理电子表格转义。
import {logChangeValueText, logChangeSummary} from '#shared/utils/admin/log-changes'
import {logChangeFields} from '#shared/config/admin/log-changes'
import type {LogRecord} from '#shared/types/admin/logs.ts'
import {logResultNames, logReasonNames, rateLimitNames} from '#shared/config/admin/logs.ts'
import {formatLogTime} from '../../policies/log-time'

export function csvCell(value: string | null) {
    let text = (value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text) || /^\d{16,}$/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
}

export function logCsv(records: LogRecord[], includeSources: boolean) {
    const header = ['ID', '时间（北京时间）', '操作者ID', '账号', '事件代码', '事件名称', '结果', '目标类型', '目标ID', '目标名称', 'Request ID', '原因', '请求方法', '接口模板', '所需权限', '限流范围', '导出条件', '清理信息', ...(includeSources ? ['可信IP', 'User-Agent'] : []), '变更摘要', '变更明细']
    const rows = records.map(row => [row.id, formatLogTime(row.createdAt), row.actorId, row.account, row.action, row.actionName, logResultNames[row.result], row.targetType, row.targetId, row.targetName, row.requestId, row.reasonCode ? logReasonNames[row.reasonCode as keyof typeof logReasonNames] ?? null : null, row.requestMethod ?? null, row.routeTemplate ?? null, row.permissionCode ?? null, row.rateLimitScope ? rateLimitNames[row.rateLimitScope] ?? null : null, row.exportContext ? JSON.stringify(row.exportContext) : null, row.cleanupContext ? JSON.stringify(row.cleanupContext) : null, ...(includeSources ? [row.ip, row.userAgent] : []), logChangeSummary(row.changeContext), row.changeContext ? row.changeContext.fields.map(item => `${logChangeFields[item.field]}：${logChangeValueText(item.before)} → ${logChangeValueText(item.after)}`).join('；') : null])
    return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
