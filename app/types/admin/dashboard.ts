// 后台仪表盘指标展示与跳转配置的前端类型。
import type {DashboardMetricKey} from '#shared/types/admin/dashboard'

export interface DashboardMetricDefinition {
    key: DashboardMetricKey;
    label: string;
    path: string;
    note: string;
    query?: Record<string, string>
}

