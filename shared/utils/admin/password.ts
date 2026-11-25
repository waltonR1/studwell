// 按 Unicode 码点检查密码长度，供表单预检与服务端校验共用；不修改密码内容。
import type {PasswordLengthPolicy} from '../../types/admin/password'
import {DEFAULT_PASSWORD_POLICY} from '../../config/admin/password'

// 未传 policy 时仅使用共享默认范围，不读取数据库；需遵循当前有效策略的调用方应显式传入服务端解析或接口返回的策略。
export function isPasswordLengthValid(password: string, policy: Readonly<PasswordLengthPolicy> = DEFAULT_PASSWORD_POLICY) {
    const length = [...password].length
    return length >= policy.minLength && length <= policy.maxLength
}
