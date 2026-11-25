// 后台任务调度、执行记录与响应的共享类型；运行时常量位于 config/admin/tasks；不包含执行令牌或数据库身份。
import type {z} from 'zod'
import type {taskCodes, runStatuses, runTriggers} from '../../config/admin/tasks'
import type {taskScheduleSchema, taskRetentionSchema} from '../../schemas/admin/tasks'

export type TaskCode = typeof taskCodes[number]
export type TaskSchedule = z.output<typeof taskScheduleSchema>
export type TaskRetention = z.output<typeof taskRetentionSchema>
export type RunStatus = typeof runStatuses[number]
export type RunTrigger = typeof runTriggers[number]
export type TaskCount = {
    kind: string;
    deletedCount: number;
    batches: number;
    limitReached: boolean;
    cutoff?: string;
    retentionDays?: number
}

export interface TaskRecord {
    id: string;
    code: TaskCode;
    name: string;
    description: string;
    enabled: boolean;
    version: number;
    appliedVersion: number
    schedule: TaskSchedule;
    retention: TaskRetention | null;
    scheduleText: string;
    nextTimes: string[]
    nextRunAt: string | null;
    online: boolean;
    executionAllowed: boolean;
    activeRun: TaskRunRecord | null;
    lastRun: TaskRunRecord | null
}

export interface TaskRunRecord {
    id: string;
    taskId: string;
    taskCode: TaskCode;
    groupId: string;
    requestId: string;
    trigger: RunTrigger;
    status: RunStatus
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null
    counts: TaskCount[];
    reason: string | null;
    retryAt: string | null;
    attempt: number;
    continuation: number
    snapshot: { schedule: TaskSchedule; retention: TaskRetention | null };
    pendingControl: 'stop' | 'force' | null
}

// 任务计划预览接口返回计算时间及对应的计划说明。
export interface TaskPreviewResponse {
    times: string[];
    text: string
}
