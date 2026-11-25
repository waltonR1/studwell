// 执行基础设施的固定参数，不属于管理员可覆盖的计划或保留策略。
export const LEASE_MS = 90_000
// 调度器心跳的在线判定窗口，与单次执行租约分别维护。
export const TASK_SCHEDULER_OFFLINE_MS = 90_000
export const TASK_POLL_MS = 5000
export const TASK_SHUTDOWN_GRACE_MS = 15_000
export const TASK_DIAGNOSTIC_INTERVAL_MS = 60_000
export const TASK_STARTUP_DELAY_MS = 60_000
// 有界重试和续批策略；耗尽后回到正常计划。
export const TASK_RETRY_DELAYS_MS = [60_000, 300_000] as const
export const TASK_MAX_CONTINUATIONS = 2
export const TASK_CONTINUATION_DELAY_MS = 60_000
