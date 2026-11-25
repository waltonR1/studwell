// 可测试的 HTTP Handler 工厂；真实路由与测试共用，不创建调试 API。
import {z} from 'zod'
import {usernameSchema} from '#shared/schemas/admin/users.ts'
import type {AdminSessionState, AdminLoginRequest, AdminChangePasswordRequest} from '#shared/types/admin/auth.ts'
import {defineApiHandler} from '../handler'
import {parseJsonBody} from '../validation'
import type {createAuthService} from '../../services/auth'
import {csrfToken} from '../../services/auth'
import {authMeta, clearSessionCookie, readSessionCookie, writeSessionCookie, type AuthHttpOptions} from '../auth'

const credentials = z.strictObject({
    username: usernameSchema,
    password: z.string().min(1).max(256)
}) satisfies z.ZodType<AdminLoginRequest>
const passwordChange = z.strictObject({
    oldPassword: z.string().min(1).max(256),
    newPassword: z.string().min(1).max(256)
}) satisfies z.ZodType<AdminChangePasswordRequest>

export function authHandlers(service: ReturnType<typeof createAuthService>, options: AuthHttpOptions) {
    return {
        session: defineApiHandler(async (event): Promise<AdminSessionState> => {
            const {raw, current} = await service.bootstrap(readSessionCookie(event), authMeta(event, options))
            writeSessionCookie(event, raw, options, current.session.expiresAt)
            return {
                passwordPolicy: current.user ? await service.passwordPolicy() : undefined,
                authenticated: !!current.user,
                mustChangePassword: current.user?.mustChangePassword ?? false,
                user: current.user ? {
                    id: String(current.user.id),
                    username: current.user.username,
                    displayName: current.user.displayName,
                    isRoot: current.user.isRoot
                } : null,
                csrfToken: csrfToken(raw)
            }
        }),
        login: defineApiHandler(async event => {
            const input = await parseJsonBody(event, credentials)
            const result = await service.login(readSessionCookie(event)!, input.username, input.password, authMeta(event, options))
            writeSessionCookie(event, result.raw, options, result.expiresAt)
            return {mustChangePassword: result.mustChangePassword}
        }),
        logout: defineApiHandler(async event => {
            await service.logout(readSessionCookie(event)!, authMeta(event, options))
            clearSessionCookie(event, options)
            return null
        }),
        password: defineApiHandler(async event => {
            const input = await parseJsonBody(event, passwordChange)
            await service.changePassword(readSessionCookie(event)!, input.oldPassword, input.newPassword, authMeta(event, options))
            clearSessionCookie(event, options)
            return null
        }),
    }
}
