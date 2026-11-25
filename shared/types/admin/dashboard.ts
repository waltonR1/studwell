// 后台仪表盘的指标标识与 API 响应契约；展示配置归前端，统计权限规则归服务端。
export type DashboardMetricKey =
    'users'
    | 'roles'
    | 'dictionaries'
    | 'loginSuccess'
    | 'loginFailed'
    | 'auditToday'
    | 'securityToday'

export interface DashboardData {
    stats: Partial<Record<DashboardMetricKey, number>>;
    updatedAt: string;
    range: { start: string; endExclusive: string }
}
