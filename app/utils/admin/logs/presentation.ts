// 日志来源值、账号名称与系统维护身份的展示转换，不读取会话或请求数据。
import type {LogRecord} from '#shared/types/admin/logs'

export function hasSource(value: string | null | undefined) {
    return !!value && value !== 'unknown'
}

export function accountName(row: LogRecord) {
    return row.account ?? (row.actorId !== null ? '账号信息不可用' : kindIsMaintenance(row) ? '系统执行' : '未识别账号')
}

export function kindIsMaintenance(row: LogRecord) {
    return row.kind === 'audit' && row.actorId === null && row.targetType === 'maintenance'
}
