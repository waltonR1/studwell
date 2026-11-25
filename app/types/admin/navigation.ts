// 后台导航的界面交互类型，不包含运行时状态。
export interface AdminNavigationContext {
    ownerId: string
    generation: number
    active: boolean
}

export interface AdminDetailParent {
    label: string
    to: string
}

// 当前详情页向框架提供的面包屑信息。
export interface AdminDetailLabel {
    path: string
    label: string
    parents?: AdminDetailParent[]
}
