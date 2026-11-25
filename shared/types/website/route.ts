// 官网页面路由树节点的跨端数据合同，不包含数据库身份或后台表单状态。
export interface WebsiteRouteNode {
    id: string
    parentId: string | null
    slug: string
    targetType: 'group' | 'page'
    enabled?: boolean
    resourceId: string | null
}

