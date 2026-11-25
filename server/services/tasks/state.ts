// 协调任务入队、抢占、租约复核及结束状态事务。
import {LEASE_MS} from '../../config/task-execution'
// 所有执行入口共用任务行抢占；批次持锁防止过期执行提交到新执行中。
import {randomUUID} from 'node:crypto'
import type {Database, DatabaseTransaction} from '../../db/transaction'
import {taskRepository as repo, type TaskRow} from '../../repositories/tasks'
import {taskFollowup} from '../../policies/task-followup'
import type {RunStatus, RunTrigger, TaskCode} from '#shared/types/admin/tasks.ts'
import {TaskCancelled} from '../cleanup/control'

export async function enqueueTask(tx: DatabaseTransaction, task: TaskRow, trigger: RunTrigger, actor: bigint | null, now: Date) {
    if (task.activeRunId !== null) throw new Error('TASK_BUSY')
    const token = randomUUID(), requestId = randomUUID(),
        groupId = (trigger === 'retry' || trigger === 'continuation' ? task.pendingGroupId : null) ?? randomUUID()
    const runId = await repo.insertRun(tx, {
        taskId: task.id,
        token,
        groupId,
        requestId,
        trigger,
        snapshot: {schedule: task.schedule, retention: task.retention},
        counts: [],
        attempt: trigger === 'retry' ? task.pendingRetry : 0,
        continuation: trigger === 'continuation' || trigger === 'retry' ? task.pendingContinuation : 0,
        createdBy: actor,
        createdAt: now
    })
    await repo.updateTask(tx, task.id, {
        activeRunId: runId,
        activeToken: token,
        ownerId: null,
        leaseUntil: null,
        nextRunAt: null,
        pendingGroupId: null
    })
    return (await repo.run(tx, runId))!
}

export async function lockExecution(tx: DatabaseTransaction, runId: bigint, token: string) {
    const first = await repo.run(tx, runId)
    if (!first) throw new TaskCancelled('LEASE_LOST')
    const task = await repo.task(tx, first.taskId, true)
    const run = await repo.run(tx, runId, true)
    if (!task || !run || task.activeRunId !== runId || task.activeToken !== token || run.token !== token || run.status !== 'running') throw new TaskCancelled('LEASE_LOST')
    if (!task.leaseUntil || task.leaseUntil.getTime() <= Date.now()) throw new TaskCancelled('LEASE_LOST')
    return {task, run}
}

export async function finishTask(db: Database, runId: bigint, token: string, status: RunStatus, reason: string | null, now = new Date(), expiredOnly = false, fromWorker = false) {
    const result = await db.transaction(async tx => {
        const first = await repo.run(tx, runId)
        if (!first) return
        // 取得此锁意味着旧批次事务已结束；强制终止不能仅凭发送信号就标完成。
        const task = await repo.task(tx, first.taskId, true), run = await repo.run(tx, runId, true)
        if (!task || !run || task.activeRunId !== runId || task.activeToken !== token || !['queued', 'running'].includes(run.status)) return
        if (expiredOnly && task.leaseUntil && task.leaseUntil > now) return
        const commands = await repo.pendingCommands(tx, runId)
        const force = commands.some(c => c.token === token && c.action === 'force')
        const stop = commands.some(c => c.token === token && c.action === 'stop')
        // 强制终止必须由父控制器在exit之后确认；worker不可抢先写终态。
        if (force && fromWorker) return
        if (force) {
            status = 'terminated';
            reason = 'FORCE_STOPPED'
        } else if (stop) {
            status = 'stopped';
            reason = 'STOPPED'
        }
        const {nextRunAt, pendingTrigger, pendingGroupId, pendingRetry, pendingContinuation} =
            taskFollowup({...task, code: task.code as TaskCode}, run, status, now)
        await repo.updateRun(tx, runId, {
            status,
            reason,
            finishedAt: now,
            retryAt: pendingTrigger === 'retry' ? nextRunAt : null
        })
        await repo.updateTask(tx, task.id, {
            activeRunId: null,
            activeToken: null,
            ownerId: null,
            leaseUntil: null,
            nextRunAt: task.code === 'search_rebuild' && task.enabled && status === 'success' && task.nextRunAt ? task.nextRunAt : nextRunAt,
            pendingTrigger,
            pendingGroupId,
            pendingRetry,
            pendingContinuation
        })
        await repo.acknowledgeCommands(tx, runId, now)
        return {
            timestamp: now.toISOString(),
            level: 'info',
            event: 'admin_maintenance',
            job: task.code,
            runId: String(runId),
            requestId: run.requestId,
            status,
            reason,
            deletedCount: run.counts.reduce((sum, count) => sum + count.deletedCount, 0),
            attempt: run.attempt,
            retryAt: pendingTrigger === 'retry' ? nextRunAt?.toISOString() ?? null : null
        }
    }, {isolationLevel: 'read committed'})
    if (result) console.log(JSON.stringify(result))
}

export async function claimQueuedTask(db: Database, taskId: bigint, ownerId: string, now = new Date()) {
    return db.transaction(async tx => {
        const task = await repo.task(tx, taskId, true)
        if (!task?.activeRunId) return null
        const run = await repo.run(tx, task.activeRunId, true)
        if (!run || run.status !== 'queued' || task.ownerId !== null) return null
        await repo.updateTask(tx, task.id, {
            ownerId,
            leaseUntil: new Date(now.getTime() + LEASE_MS)
        })
        await repo.updateRun(tx, run.id, {status: 'running', startedAt: now})
        return {...run, status: 'running', startedAt: now}
    }, {isolationLevel: 'read committed'})
}
