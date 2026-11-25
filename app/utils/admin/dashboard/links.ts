// 根据当前导航投影生成首页入口与统计链接；仅用于展示，不代替服务端鉴权。
import type {NavigationItem} from '#shared/types/admin/menus.ts'
import type {DashboardMetricDefinition} from '~/types/admin/dashboard'

export function dashboardLinks(items: NavigationItem[]) {
    const seen = new Set<string>()
    return items.flatMap(item => {
        if (!item.path || seen.has(item.path)) return []
        seen.add(item.path)
        return [{id: item.id, name: item.name, path: item.path}]
    })
}

export function dashboardMetricLink(definition: DashboardMetricDefinition, items: NavigationItem[]) {
    return items.some(item => item.path === definition.path) ? {
        path: definition.path,
        query: definition.query
    } : undefined
}
