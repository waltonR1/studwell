// 数据库与日志写入边界只接受所属分类的已登记结果；未知值不映射为成功或失败。
import {logResults} from '#shared/config/admin/logs'
import type {LogKind, LogResult} from '#shared/types/admin/logs'
import {ApiError} from '../core/errors'

export function requireLogResult(value: unknown, kind: LogKind): LogResult {
    const result = logResults[kind].find(result => result === value)
    if (result === undefined) throw new ApiError('INTERNAL_ERROR')
    return result
}
