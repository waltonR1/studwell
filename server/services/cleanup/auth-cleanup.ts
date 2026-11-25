// 只回收绝对到期会话和超过全部允许窗口的限流键；不改变认证与限流判断。
import {randomUUID} from 'node:crypto'
import type {Database} from '../../db/transaction'
import {cleanupRepository} from '../../repositories/cleanup'
import {rateCleanupCutoff, validateCleanupBudget} from '../../policies/cleanup'
import {CLEANUP_BATCH_SIZE, CLEANUP_MAX_BATCHES} from '../../config/cleanup'
import {auditService} from '../audit'
import {TaskCancelled, type MaintenanceControl} from './control'

export async function cleanupAuthState(db: Database, clock = () => new Date(), options: {
    batchSize?: number;
    maxBatches?: number;
    control?: MaintenanceControl
} = {}) {
    const batchSize = options.batchSize ?? CLEANUP_BATCH_SIZE, maxBatches = options.maxBatches ?? CLEANUP_MAX_BATCHES
    validateCleanupBudget(batchSize, maxBatches)
    const now = clock(), requestId = options.control?.requestId ?? randomUUID()
    const results: Array<{ kind: 'sessions' | 'rate_limits'; deletedCount: number; limitReached: boolean }> = []
    for (const kind of ['sessions', 'rate_limits'] as const) {
        const name = kind === 'sessions' ? '过期会话' : '过期限流计数'
        const meta = {
            actorId: null,
            action: `${kind}.cleanup`,
            targetType: 'maintenance',
            ip: 'local',
            userAgent: 'internal-auth-cleanup',
            requestId
        }
        let deletedCount = 0, limitReached = false
        for (let batch = 1; batch <= maxBatches; batch++) {
            try {
                const count = await db.transaction(async tx => {
                    await options.control?.beforeBatch(tx)
                    // 行锁覆盖选择、删除和审计；与请求更新窗口串行，避免选择后被续期。
                    const count = kind === 'sessions'
                        ? await cleanupRepository.sessions(tx, now, batchSize)
                        : await cleanupRepository.rateLimits(tx, rateCleanupCutoff(now), batchSize)
                    // 空批次不刷审计；不记录 Token 哈希、限流身份键、用户或来源。
                    if (count) await auditService.write(tx, {
                        ...meta,
                        targetName: `${name}（本批 ${count} 条）`,
                        result: 'success',
                        createdAt: clock()
                    })
                    await options.control?.committed(tx, {
                        kind,
                        deletedCount: count,
                        cutoff: (kind === 'sessions' ? now : rateCleanupCutoff(now)).toISOString(),
                        limitReached: batch === maxBatches && count === batchSize
                    })
                    return count
                }, {isolationLevel: 'read committed'})
                deletedCount += count
                limitReached = batch === maxBatches && count === batchSize
                if (count < batchSize) break
            } catch (cause) {
                if (cause instanceof TaskCancelled) throw cause
                await auditService.failure(db, {
                    ...meta,
                    targetName: `${name}（当前批次已回滚）`,
                    result: 'failed',
                    createdAt: clock()
                }, cause)
                throw cause
            }
        }
        results.push({kind, deletedCount, limitReached})
    }
    return {requestId, results}
}
