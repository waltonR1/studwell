// 在事务内确认到期任务并入队，不创建运行期定时器。
import type {Database} from '../../db/transaction'
import {taskRepository as repo} from '../../repositories/tasks'
import {nextTaskTimes} from '../../policies/task-schedule'
import {TASK_STARTUP_DELAY_MS} from '../../config/task-execution'
import type {TaskCode, RunTrigger} from '#shared/types/admin/tasks'
import {enqueueTask} from './state'

// 事务内复核版本和活动执行，决定是否将到期任务入队。
export async function scheduleDueTask(db: Database, taskId: bigint, now: Date) {
    await db.transaction(async tx => {
        const current = await repo.task(tx, taskId, true)
        if (!current || current.activeRunId !== null) return
        const next = current.nextRunAt ?? (current.enabled ? new Date(Math.min(now.getTime() + TASK_STARTUP_DELAY_MS, nextTaskTimes(current.code as TaskCode, current.schedule, now, 1)[0]!.getTime())) : null)
        await repo.updateTask(tx, current.id, {
            heartbeatAt: now,
            appliedVersion: current.version,
            nextRunAt: next
        })
        if (current.enabled && next && next <= now) await enqueueTask(tx, current, current.pendingTrigger as RunTrigger, null, now)
    }, {isolationLevel: 'read committed'})
}
