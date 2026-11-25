// 后台密码长度硬边界及未取得有效策略时的默认范围；不包含弱口令或哈希配置。
import type {PasswordLengthPolicy} from '../../types/admin/password'

export const PASSWORD_MIN_LENGTH = 6
export const PASSWORD_MAX_LENGTH = 128
export const DEFAULT_PASSWORD_POLICY: Readonly<PasswordLengthPolicy> = {
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH
}
