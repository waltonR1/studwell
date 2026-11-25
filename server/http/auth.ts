// 适配认证 Cookie、请求操作者与认证守卫，依赖由入口传入。
import {matchesAdminPath} from '../policies/admin-route'
import {adminRoutePolicies} from '../config/permissions'
import type {LogReasonCode} from '#shared/types/admin/logs'
// HTTP 认证适配：可信来源、Cookie、CSRF、默认保护；不包含数据库查询。
import {getRequestIP, getCookie, getHeader, setCookie, deleteCookie, type H3Event} from 'h3'
import {isIP} from 'node:net'
import {createAuthService, csrfToken, safeTokenEqual} from '../services/auth'
import {type AuthMeta} from '../core/auth-context'
import {ApiError} from '../core/errors'

export const SESSION_COOKIE = 'studwell_admin_session'

export interface AuthHttpOptions {
    origin: string;
    secureCookie: boolean;
    trustedProxyIps?: string[]
}

export function authMeta(event: H3Event, options?: AuthHttpOptions): AuthMeta {
    // socket 优先，缺失时接受 H3 的服务端 clientAddress，不启用 X-Forwarded-For。
    const candidate = (event.node.req.socket?.remoteAddress ?? getRequestIP(event, {xForwardedFor: false}))?.replace(/^::ffff:/, '')
    const peer = candidate && isIP(candidate) ? candidate : 'unknown'
    const forwarded = getHeader(event, 'x-real-ip') ?? ''
    // 只支持显式白名单中的直接代理，且要求代理覆盖单个 X-Real-IP；不解析不可信的转发链。
    const ip = options?.trustedProxyIps?.includes(peer) && isIP(forwarded) ? forwarded : peer
    const path = event.path.split('?')[0] ?? ''
    const policy = adminRoutePolicies.find(item => item.method === event.method && matchesAdminPath(item.path, path))
    const authPaths = ['/api/admin/auth/session', '/api/admin/auth/login', '/api/admin/auth/logout', '/api/admin/auth/password', '/api/admin/auth/profile']
    const requestMethod = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(event.method) ? event.method : undefined
    const routeTemplate = policy?.path ?? (authPaths.includes(path) ? path : undefined)
    return {
        requestMethod,
        routeTemplate,
        ip,
        userAgent: (getHeader(event, 'user-agent') ?? '').slice(0, 256),
        requestId: event.context.apiRequestId ?? ''
    }
}

export function readSessionCookie(event: H3Event) {
    return getCookie(event, SESSION_COOKIE)
}

export function writeSessionCookie(event: H3Event, token: string, options: AuthHttpOptions, expiresAt: Date) {
    setCookie(event, SESSION_COOKIE, token, {
        httpOnly: true,
        secure: options.secureCookie,
        sameSite: 'lax',
        path: '/',
        maxAge: Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000))
    })
}

export function clearSessionCookie(event: H3Event, options: AuthHttpOptions) {
    deleteCookie(event, SESSION_COOKIE, {httpOnly: true, secure: options.secureCookie, sameSite: 'lax', path: '/'})
}

export async function guardAdminRequest(event: H3Event, service: ReturnType<typeof createAuthService>, options: AuthHttpOptions, authorize?: (userId: bigint, method: string, path: string) => Promise<void>) {
    // 缺少/非法部署配置时关闭认证入口，绝不从 Host 或转发头推导可信 Origin。
    let configured: URL
    try {
        configured = new URL(options.origin)
    } catch {
        throw new Error('ADMIN_ORIGIN_INVALID')
    }
    if (!['http:', 'https:'].includes(configured.protocol) || configured.origin !== options.origin || configured.username || configured.password || (options.secureCookie && configured.protocol !== 'https:')) throw new Error('ADMIN_ORIGIN_INVALID')
    if (options.trustedProxyIps?.some(ip => !isIP(ip))) throw new Error('ADMIN_TRUSTED_PROXY_INVALID')
    const path = event.path.split('?')[0]
    const method = event.method
    const bootstrap = path === '/api/admin/auth/session' && method === 'GET'
    const login = path === '/api/admin/auth/login' && method === 'POST'
    const logout = path === '/api/admin/auth/logout' && method === 'POST'
    const change = path === '/api/admin/auth/password' && method === 'POST'
    // 本人资料从已认证会话取身份，不接受目标账号，也不依赖账号管理权限。
    const profile = path === '/api/admin/auth/profile' && ['GET', 'PUT'].includes(method)
    const raw = readSessionCookie(event)
    const current = await service.resolve(raw)
    const meta = authMeta(event, options)
    if (!['GET', 'HEAD'].includes(method)) {
        const trusted = getHeader(event, 'origin') === options.origin
        const csrf = getHeader(event, 'x-csrf-token') ?? ''
        if (!trusted || !raw || !current || !safeTokenEqual(csrf, csrfToken(raw))) {
            // 安全拒绝按来源限量记录，超限由统一限流响应处理。
            await service.limit('csrf-log', meta.ip, meta)
            const reason: LogReasonCode = !trusted ? 'ORIGIN_MISMATCH' : !raw ? 'SESSION_MISSING' : !current ? 'SESSION_INVALID' : !csrf ? 'CSRF_TOKEN_MISSING' : 'CSRF_TOKEN_INVALID'
            await service.log('csrf', 'denied', meta, current?.user?.id, current?.user?.username, reason)
            throw new ApiError('CSRF_REJECTED')
        }
    }
    if (bootstrap) {
        if (current?.user) await service.limit('session-status', String(current.user.id), meta)
        return
    }
    if (!current || (!current.user && !login && !logout)) throw new ApiError('UNAUTHENTICATED')
    if (login && current.user) throw new ApiError('CONFLICT')
    if (current.user) {
        // 媒体预览（含视频分段）独立计数，避免耗尽权限查询和业务操作额度。
        const mediaRead = ['GET', 'HEAD'].includes(method)
            && matchesAdminPath('/api/admin/media/:id/file', path ?? '')
        await service.limit(mediaRead ? 'media-read' : 'admin-api', String(current.user.id), meta)
        if (current.user.mustChangePassword && !change && !logout) throw new ApiError('PASSWORD_CHANGE_REQUIRED')
        if (!change && !logout && !profile) {
            if (!authorize) throw new ApiError('FORBIDDEN')
            try {
                await authorize(current.user.id, method, path ?? '')
            } catch (error) {
                if (error instanceof ApiError && error.code === 'FORBIDDEN') {
                    await service.limit('rbac-log', String(current.user.id), meta)
                    const policy = adminRoutePolicies.find(item => item.enabled && item.method === method && matchesAdminPath(item.path, path ?? ''))
                    await service.log('permission_check', 'denied', {
                        ...meta,
                        permissionCode: policy?.permission
                    }, current.user.id, current.user.username, policy ? 'PERMISSION_DENIED' : 'ROUTE_NOT_ALLOWED')
                }
                throw error
            }
        }
        await service.touch(raw!)
        requestActors.set(event, current.user.id)
    }
}

// 仅复用本次请求已通过守卫的身份；权限仍在写事务内复核，不跨请求缓存。
const requestActors = new WeakMap<H3Event, bigint>()
export async function requestActor(event: H3Event, service: Pick<ReturnType<typeof createAuthService>, 'resolve'>) {
    const actor = requestActors.get(event)
    if (actor !== undefined) return actor
    const current = await service.resolve(readSessionCookie(event))
    if (!current?.user) throw new ApiError('UNAUTHENTICATED')
    return current.user.id
}
