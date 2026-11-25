// 服务端统计指标的权限要求；展示配置由前端维护。
import type {DashboardMetricKey} from '#shared/types/admin/dashboard.ts'

export const dashboardMetricPermissions = {
    users: 'system.users.read',
    roles: 'system.roles.read',
    dictionaries: 'system.dictionaries.read',
    loginSuccess: 'system.logs.login.read',
    loginFailed: 'system.logs.login.read',
    auditToday: 'system.logs.audit.read',
    securityToday: 'system.logs.security.read',
} satisfies Record<DashboardMetricKey, string>
