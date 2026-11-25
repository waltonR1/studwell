// 后台认证恢复的界面交互类型，不包含运行时状态。
export interface AdminAuthRecovery {
    kind: 'expired' | 'password-change'
    returnTo: string
}
