// 将日志失败信息映射为受控原因，不输出原始敏感异常。
import {ApiError} from '../core/errors'
import {databaseConflictReason} from '../core/db-errors'
import {logReasonNames} from '#shared/config/admin/logs.ts'
import {type LogReasonCode} from '#shared/types/admin/logs'

export function logFailureReason(cause: unknown): LogReasonCode {
    const reason = databaseConflictReason(cause) ?? (cause instanceof ApiError ? cause.reason ?? cause.code : 'INTERNAL_ERROR')
    return Object.hasOwn(logReasonNames, reason) ? reason as LogReasonCode : 'INTERNAL_ERROR'
}
