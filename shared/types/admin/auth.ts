// 后台认证请求及本人会话的共享契约；不包含 Cookie、密码哈希或数据库会话字段。
import type {PasswordLengthPolicy} from './password'

export interface AdminSessionState {
    passwordPolicy?: PasswordLengthPolicy
    authenticated: boolean
    mustChangePassword: boolean
    user: { id: string; username: string; displayName: string; isRoot: boolean } | null
    csrfToken: string
}

// 请求字段契约不决定弱口令策略；有效策略由服务端系统参数控制。
export interface AdminLoginRequest {
    username: string;
    password: string
}

export interface AdminChangePasswordRequest {
    oldPassword: string;
    newPassword: string
}
