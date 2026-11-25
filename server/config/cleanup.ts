// 单次清理的资源预算，不是管理员可覆盖的业务保留策略。
export const CLEANUP_BATCH_SIZE = 1000
export const CLEANUP_MAX_BATCHES = 20
// 执行记录保留期当前固定；日志保留期仍读取任务配置快照。
export const TASK_RUN_RETENTION_DAYS = 90
