// 后台密码长度策略的共享契约；当前有效策略由服务端返回。
export interface PasswordLengthPolicy {
    minLength: number;
    maxLength: number
}
