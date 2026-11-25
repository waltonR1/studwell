// 任务基础输入限制，前端字段和共享 schema 使用同一份值；不包含调度或执行策略。
export const TASK_INTERVAL_MINUTES = {min: 5, max: 10080} as const
export const TASK_RETENTION_DAYS = {min: 1, max: 3650} as const
export const TASK_CRON_MAX_LENGTH = 120

// 固定任务与执行状态目录，schema 和两端展示共用，不反向依赖类型或 schema。
export const taskCodes = ['log_cleanup', 'auth_cleanup', 'run_cleanup', 'search_rebuild'] as const
export const runStatuses = ['queued', 'running', 'success', 'failed', 'stopped', 'terminated', 'interrupted'] as const
export const runTriggers = ['scheduled', 'startup', 'manual', 'retry', 'continuation'] as const

export const runStatusNames: Record<typeof runStatuses[number], string> = {
    queued: '排队中',
    running: '执行中',
    success: '成功',
    failed: '失败',
    stopped: '已停止',
    terminated: '已强制终止',
    interrupted: '中断/结果未知'
}
export const runTriggerNames: Record<typeof runTriggers[number], string> = {
    scheduled: '定时执行',
    startup: '启动补跑',
    manual: '手动执行',
    retry: '失败重试',
    continuation: '积压续跑'
}

