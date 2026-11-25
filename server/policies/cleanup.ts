// 计算清理时间边界及资源预算，不执行数据库删除。
import {TASK_RETENTION_DAYS} from '#shared/config/admin/tasks'
import {CLEANUP_BATCH_SIZE, CLEANUP_MAX_BATCHES} from '../config/cleanup'
import {MAX_RATE_WINDOW_SECONDS} from '../config/parameters'

export function rateCleanupCutoff(now: Date) {
    return new Date(now.getTime() - MAX_RATE_WINDOW_SECONDS * 1000)
}

const dayMs = 86400_000, beijingOffset = 8 * 3600_000

// 保留最近 N 个北京时间自然日（含当天），只删除起始日 00:00 之前的记录。
export function logRetentionCutoff(now: Date, days: number) {
    if (!Number.isInteger(days) || days < TASK_RETENTION_DAYS.min || days > TASK_RETENTION_DAYS.max) throw new Error('INVALID_RETENTION')
    const local = new Date(now.getTime() + beijingOffset)
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - beijingOffset - (days - 1) * dayMs)
}


// 默认预算也是调用方可指定预算的上限，避免绕过单次资源约束。
export function validateCleanupBudget(batchSize: number, maxBatches: number) {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > CLEANUP_BATCH_SIZE
        || !Number.isInteger(maxBatches) || maxBatches < 1 || maxBatches > CLEANUP_MAX_BATCHES) throw new Error('INVALID_CLEANUP_BATCH')
}
