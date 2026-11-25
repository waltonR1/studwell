// 首页统计请求适配，导航沿用菜单适配器。
import type {AdminApiClient} from '~/types/admin/api'
import type {DashboardData} from '#shared/types/admin/dashboard'

export function createDashboardApi(api: AdminApiClient) {
    return {getDashboard: () => api.read<DashboardData>('dashboard')}
}
