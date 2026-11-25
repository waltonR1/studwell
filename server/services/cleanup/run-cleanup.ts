// 协调任务执行记录的分批清理及进度控制。
import type {Database} from '../../db/transaction'
import type {MaintenanceControl} from './control'
import {taskRepository as repo} from '../../repositories/tasks'
import {auditService} from '../audit'
import {terminalRunStatuses} from '../../config/tasks'
import {CLEANUP_BATCH_SIZE, CLEANUP_MAX_BATCHES, TASK_RUN_RETENTION_DAYS} from '../../config/cleanup'

// 执行记录回收独立于调度入口，删除、审计和进度仍在同一事务内。
export async function cleanupTaskRuns(db: Database, control: MaintenanceControl, clock = () => new Date()) {
    const cutoff = new Date(clock().getTime() - TASK_RUN_RETENTION_DAYS * 86400_000)
    for (let batch = 1; batch <= CLEANUP_MAX_BATCHES; batch++) {
        const count = await db.transaction(async tx => {
            await control.beforeBatch(tx)
            const deletedCount = await repo.pruneRuns(tx, terminalRunStatuses, cutoff, CLEANUP_BATCH_SIZE)
            if (deletedCount) {
                await auditService.write(tx, {
                    actorId: null,
                    action: 'task_runs.cleanup',
                    targetType: 'maintenance',
                    targetName: `过期执行记录（本批 ${deletedCount} 条）`,
                    result: 'success',
                    ip: 'local',
                    userAgent: 'internal-task-cleanup',
                    requestId: control.requestId,
                    createdAt: clock()
                })
            }
            await control.committed(tx, {
                kind: 'runs',
                deletedCount: deletedCount,
                limitReached: batch === CLEANUP_MAX_BATCHES && deletedCount === CLEANUP_BATCH_SIZE,
                cutoff: cutoff.toISOString(),
                retentionDays: TASK_RUN_RETENTION_DAYS
            })
            return deletedCount
        }, {isolationLevel: 'read committed'})
        if (count < CLEANUP_BATCH_SIZE) break
    }
}
