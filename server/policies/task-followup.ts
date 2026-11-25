// 计算任务结束后的重试或续批计划，不操作运行器。
import {nextTaskTimes} from './task-schedule'
import {TASK_RETRY_DELAYS_MS, TASK_MAX_CONTINUATIONS, TASK_CONTINUATION_DELAY_MS} from '../config/task-execution'
import type {TaskCode, RunStatus, RunTrigger} from '#shared/types/admin/tasks'

// 只计算结束后的重试、续批或下一正常计划；不读取记录或提交状态。
export function taskFollowup(task: {enabled: boolean; code: TaskCode; schedule: unknown}, run: {
    attempt: number; continuation: number; groupId: string; counts: readonly {limitReached: boolean}[]
}, status: RunStatus, now: Date) {
    let nextRunAt: Date | null = task.enabled ? nextTaskTimes(task.code, task.schedule, now, 1)[0]! : null
    let pendingTrigger: RunTrigger = 'scheduled', pendingGroupId: string | null = null, pendingRetry = 0,
        pendingContinuation = 0
    if (task.enabled && ['failed', 'interrupted'].includes(status) && run.attempt < TASK_RETRY_DELAYS_MS.length) {
        nextRunAt = new Date(now.getTime() + TASK_RETRY_DELAYS_MS[run.attempt]!);
        pendingTrigger = 'retry';
        pendingGroupId = run.groupId;
        pendingRetry = run.attempt + 1;
        pendingContinuation = run.continuation
    } else if (task.enabled && status === 'success' && run.counts.some(row => row.limitReached) && run.continuation < TASK_MAX_CONTINUATIONS) {
        nextRunAt = new Date(now.getTime() + TASK_CONTINUATION_DELAY_MS);
        pendingTrigger = 'continuation';
        pendingGroupId = run.groupId;
        pendingContinuation = run.continuation + 1
    }
    return {nextRunAt, pendingTrigger, pendingGroupId, pendingRetry, pendingContinuation}
}
