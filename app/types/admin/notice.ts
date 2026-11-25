// 后台请求横幅的界面交互类型，不包含运行时状态。
export interface AdminNotice {
    kind: 'csrf' | 'permission' | 'warning'
    message: string
}
