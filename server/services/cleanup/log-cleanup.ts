// 协调日志分批清理、控制复核和审计，删除由仓储执行。
import {randomUUID} from 'node:crypto'
import type {Database} from '../../db/transaction'
import {cleanupRepository} from '../../repositories/cleanup'
import {logRetentionCutoff, validateCleanupBudget} from '../../policies/cleanup'
import {CLEANUP_BATCH_SIZE, CLEANUP_MAX_BATCHES} from '../../config/cleanup'
import {logKinds, logNames} from '#shared/config/admin/logs.ts'
import {type LogKind} from '#shared/types/admin/logs'
import type {LogCleanupContext} from '#shared/types/admin/logs.ts'
import {resolveLogRetention} from '../parameter-values'
import {auditService} from '../audit'
import {TaskCancelled, type MaintenanceControl} from './control'

// 无公开清理 API。每批行锁、删除与审计同事务；多实例 SKIP LOCKED 不重复处理同一批。
export async function cleanupLogs(db: Database, clock = () => new Date(), options: {
    batchSize?: number;
    maxBatches?: number;
    control?: MaintenanceControl;
    policy?: { enabled: boolean; days: Record<LogKind, number> }
} = {}) {
    const batchSize = options.batchSize ?? CLEANUP_BATCH_SIZE, maxBatches = options.maxBatches ?? CLEANUP_MAX_BATCHES
    validateCleanupBudget(batchSize, maxBatches)
    const policy = options.policy ?? await resolveLogRetention(db)
    if (!policy.enabled) return {enabled: false, results: []}
    const started = clock(), requestId = options.control?.requestId ?? randomUUID()
    const meta = {
        actorId: null,
        action: 'logs.cleanup',
        targetType: 'maintenance',
        ip: 'local',
        userAgent: 'internal-log-cleanup',
        requestId
    }
    const results: Array<{ kind: LogKind; deletedCount: number; limitReached: boolean }> = []
    for (const kind of logKinds) {
        const cutoff = logRetentionCutoff(started, policy.days[kind])
        let deletedCount = 0, limitReached = false
        for (let batch = 1; batch <= maxBatches; batch++) {
            const context: LogCleanupContext = {
                version: 1,
                kind,
                retentionDays: policy.days[kind],
                cutoff: cutoff.toISOString(),
                deletedCount: 0,
                batch,
                limitReached: false
            }
            try {
                const count = await db.transaction(async tx => {
                    await options.control?.beforeBatch(tx)
                    const count = await cleanupRepository.logs(tx, kind, cutoff, batchSize)
                    // 无可清理记录时每类仅记录一次；非空批次各有独立的准确删除数量。
                    if (count || batch === 1) await auditService.write(tx, {
                        ...meta,
                        targetName: logNames[kind] + '保留期清理',
                        result: 'success',
                        createdAt: clock(),
                        cleanupContext: {
                            ...context,
                            deletedCount: count,
                            limitReached: batch === maxBatches && count === batchSize
                        }
                    })
                    await options.control?.committed(tx, {
                        kind,
                        deletedCount: count,
                        cutoff: cutoff.toISOString(),
                        retentionDays: policy.days[kind],
                        limitReached: batch === maxBatches && count === batchSize
                    })
                    return count
                }, {isolationLevel: 'read committed'})
                deletedCount += count
                limitReached = batch === maxBatches && count === batchSize
                if (count < batchSize) break
            } catch (error) {
                if (error instanceof TaskCancelled) throw error
                // 当前批次已回滚，失败记录不把已回滚的删除计入；此前批次审计仍保留。
                await auditService.failure(db, {
                    ...meta,
                    targetName: logNames[kind] + '保留期清理',
                    result: 'failed',
                    createdAt: clock(),
                    cleanupContext: context
                }, error)
                throw error
            }
        }
        results.push({kind, deletedCount, limitReached})
    }
    return {enabled: true, requestId, results}
}
