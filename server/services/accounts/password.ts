// 本地密码策略与 Argon2id；不做密码规范化或截断，不记录输入。
import {argon2id, hash, needsRehash, verify} from 'argon2'
import {createHash} from 'node:crypto'
import blockedHashes from '../../data/security/password-blocklist.json'
import {DEFAULT_PASSWORD_POLICY, PASSWORD_MAX_LENGTH} from '#shared/config/admin/password.ts'
import {isPasswordLengthValid} from '#shared/utils/admin/password.ts'
import {ApiError} from '../../core/errors'

export const passwordHashOptions = {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32
} as const
// 仅覆盖明确列出的常见/已知泄露长口令，不宣称覆盖完整泄露库。
const blocked = new Set(['passwordpassword', 'password123456789', '123456789012345', '12345678901234567890', 'qwertyuiopasdfgh', 'adminadminadmin', 'letmeinletmeinletmein', 'correct horse battery staple'])
const compromised = new Set<string>(blockedHashes as string[])

export function validatePassword(password: string, checkBlocklist: boolean = true, policy = DEFAULT_PASSWORD_POLICY) {
    if (typeof password !== 'string') throw new ApiError('INVALID_INPUT')
    if (!isPasswordLengthValid(password, policy)) {
        throw new ApiError('INVALID_INPUT', [{
            path: 'password',
            message: `密码须为 ${policy.minLength}–${policy.maxLength} 个字符`
        }])
    }
    if (checkBlocklist && (blocked.has(password.toLowerCase()) || compromised.has(createHash('sha256').update(password.toLowerCase()).digest('hex')))) {
        throw new ApiError('INVALID_INPUT', [{path: 'password', message: '密码不能使用已知弱口令'}])
    }
}

export async function hashPassword(password: string, checkBlocklist: boolean = true, policy = DEFAULT_PASSWORD_POLICY) {
    validatePassword(password, checkBlocklist, policy)
    return hash(password, passwordHashOptions)
}

export async function verifyPassword(encoded: string, password: string) {
    if ([...password].length > PASSWORD_MAX_LENGTH || !encoded.startsWith('$argon2id$')) return false
    return verify(encoded, password)
}

export function passwordNeedsRehash(encoded: string) {
    if (!encoded.startsWith('$argon2id$')) return true
    try {
        return needsRehash(encoded, passwordHashOptions)
    } catch {
        return true
    }
}
