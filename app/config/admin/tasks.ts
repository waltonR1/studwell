// 任务执行状态的前端颜色配置；不决定状态转移或控制权限。
import type {RunStatus} from '#shared/types/admin/tasks'

export const taskRunTones = {
    queued: 'warning',
    running: 'warning',
    success: 'success',
    failed: 'danger',
    stopped: 'neutral',
    terminated: 'danger',
    interrupted: 'danger',
} as const satisfies Record<RunStatus, 'success' | 'warning' | 'danger' | 'neutral'>

// 后台页面活动期间的轮询间隔。
export const ADMIN_TASK_POLL_INTERVAL_MS = 10000

// 任务执行明细中的计数名称，仅用于后台展示。
export const taskCountNames: Record<string, string> = {
  login: '登录日志',
  audit: '操作审计',
  security: '安全日志',
  sessions: '会话',
  rate_limits: '限流记录',
  runs: '执行记录'
}
