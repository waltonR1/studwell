// 后台列表 URL、筛选草稿和提交动作合同；不包含状态或导航实现。
export interface AdminListStatusLabels {column:string;filter:string;visible:string;hidden:string}
export interface AdminListRouteState {
    search: string
    filter: string
    page: number
    pageSize: number | undefined
}

export interface AdminListDraft {
    search: string
    filter: string
    pageSize: string
}

export type AdminListAction =
    | { type: 'search' }
    | { type: 'filter' }
    | { type: 'pageSize' }
    | { type: 'page'; page: number }

export interface BuildAdminListQueryOptions {
    applied: AdminListRouteState
    draft: AdminListDraft
    action: AdminListAction
    filterKey: string
    paginated?: boolean
}


export interface UseAdminListQueryOptions {
    path: string
    filterKey: string
    filterValues: readonly string[]
    defaultPageSize: number
    paginated?: boolean
}

