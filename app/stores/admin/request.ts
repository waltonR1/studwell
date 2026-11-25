// 请求协调 store：身份恢复、CSRF、权限刷新及请求代次；传输只依赖下层 API。
import {defineStore} from 'pinia'
import type {AdminLoginRequest, AdminChangePasswordRequest} from '#shared/types/admin/auth'
import type {AdminPermissions} from '#shared/types/admin/roles'
import {createAdminHttpApi} from '~/api/admin/http'
import {useAdminSessionStore} from './session'
import {useAdminNoticeStore} from './notice'
import {useAdminNavigationStore} from './navigation'
import {adminRequestMessage, adminOperationMessage, createLocalAdminFailure,
    createAdminSessionChangedError, getAdminRequestFailure, isAdminSessionChangedError,
    isCsrfFailure, isPasswordChangeFailure, isSessionExpiryFailure} from '~/utils/admin/request/errors'
export const useAdminRequestStore = defineStore('admin-request', () => {
    const http = createAdminHttpApi()
    const serverReturnTo = import.meta.server ? useRequestEvent()?.path : undefined
    const auth = useAdminSessionStore(), notice = useAdminNoticeStore(), navigation = useAdminNavigationStore()
    // Cookie 也属于会话状态：读取与认证写入必须串行，避免迟到的 Set-Cookie 覆盖新身份。
    let sessionQueue: Promise<unknown> = Promise.resolve()
    let sessionRefresh: Promise<Awaited<ReturnType<typeof loadSession>>> | undefined

    function coordinateSession<T>(operation: () => Promise<T>): Promise<T> {
        const pending = sessionQueue.then(operation)
        sessionQueue = pending.catch(() => {})
        return pending
    }

    function returnTo(target?: string) {
        if (target)
            return target
        if (import.meta.client)
            return `${window.location.pathname}${window.location.search}${window.location.hash}`
        return serverReturnTo || '/admin'
    }

    async function handleFailure(error: unknown, requestGeneration: number, target?: string) {
        if (requestGeneration !== auth.generation || isAdminSessionChangedError(error)) return
        const failure = getAdminRequestFailure(error)
        if (!failure) return
        if (isCsrfFailure(failure)) {
            try {
                const state = await refreshSession()
                if (auth.session !== state)
                    return
                if (!state.authenticated) {
                    auth.markExpired(returnTo(target))
                    return
                }
                if (requestGeneration !== auth.generation)
                    return
                notice.setNotice({kind: 'csrf', message: adminRequestMessage(error)})
            } catch (cause) {
                if (requestGeneration !== auth.generation || isAdminSessionChangedError(cause)) return
                notice.setNotice({
                    kind: 'warning',
                    message: '安全校验失败，且暂时无法确认登录状态。本次操作未提交，请检查网络后刷新页面。'
                })
            }
            return
        }
        if (isSessionExpiryFailure(failure) || isPasswordChangeFailure(failure)) {
            let state: Awaited<ReturnType<typeof refreshSession>> | null = null
            try {
                state = await refreshSession()
            } catch (cause) {
                if (requestGeneration !== auth.generation || isAdminSessionChangedError(cause)) return
            }
            if (state && auth.session !== state)
                return
            if (state && (isPasswordChangeFailure(failure) || state.mustChangePassword)) {
                auth.markPasswordChangeRequired(returnTo(target))
                return
            }
            if (state && !state.authenticated) {
                auth.markExpired(returnTo(target))
                return
            }
            if (requestGeneration !== auth.generation)
                return
            if (!state) {
                auth.markExpired(returnTo(target))
            } else {
                notice.setNotice({
                    kind: 'warning',
                    message: '原请求使用的登录会话已失效，但当前登录仍然有效。本次请求未执行，请重试。'
                })
            }
        }
    }

    async function read<T>(path: string, query?: Record<string, string | number | undefined>, expectedGeneration = auth.generation, target?: string) {
        try {
            const data = await http.read<T>(path, query)
            if (expectedGeneration !== auth.generation) throw createAdminSessionChangedError()
            return data
        } catch (error) {
            await handleFailure(error, expectedGeneration, target)
            throw error
        }
    }

    async function refreshPermissions(target?: string) {
        const generation = auth.generation
        const next = await read<AdminPermissions>('auth/permissions', undefined, generation, target)
        if (!auth.acceptPermissions(next, generation))
            throw createAdminSessionChangedError()
    }

    async function authenticatedWrite<T>(work: (csrfToken: string) => Promise<T>, target?: string) {
        const generation = auth.generation
        let csrfToken = auth.session?.csrfToken
        if (!auth.session?.authenticated || !csrfToken) {
            const state = await refreshSession()
            if (generation !== auth.generation) throw createAdminSessionChangedError()
            if (!state.authenticated) {
                auth.markExpired(returnTo(target))
                throw createLocalAdminFailure('UNAUTHENTICATED')
            }
            if (state.mustChangePassword) {
                auth.markPasswordChangeRequired(returnTo(target))
                throw createLocalAdminFailure('PASSWORD_CHANGE_REQUIRED')
            }
            csrfToken = state.csrfToken
        }
        try {
            const result = await work(csrfToken)
            if (generation !== auth.generation) throw createAdminSessionChangedError()
            navigation.invalidate()
            return result
        } catch (error) {
            await handleFailure(error, generation, target)
            throw error
        }
    }

    function mutate<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body: object, target?: string) {
        return authenticatedWrite(token => http.mutate<T>(path, method, body, token), target)
    }

    function upload<T>(path: string, file: File, query?: Record<string,string>, progress?: (value:number)=>void) {
        return authenticatedWrite(token => http.upload<T>(path, file, token, query, progress))
    }

    function message(error: unknown) {
        return adminRequestMessage(error)
    }

    function operationMessage(error: unknown) {
        return adminOperationMessage(error, !!(notice.notice || auth.recovery))
    }

    async function loadSession() {
        const generation = auth.generation
        const next = await http.session()
        if (!auth.acceptSession(next, generation))
            throw createAdminSessionChangedError()
        return auth.session!
    }

    function refreshSession() {
        if (!sessionRefresh) {
            const pending = coordinateSession(loadSession)
            sessionRefresh = pending
            void pending.finally(() => {
                if (sessionRefresh === pending) sessionRefresh = undefined
            }).catch(() => {})
        }
        return sessionRefresh
    }

    type AuthWrite = [path: 'login', body: AdminLoginRequest] | [path: 'password', body: AdminChangePasswordRequest] | [path: 'logout']

    async function performWrite(...[path, body]: AuthWrite) {
        // 页面停留期间 Cookie 可能过期或被其他标签页更换，提交前重新引导。
        let state = await loadSession()
        if (path === 'login' && state.authenticated && state.user?.username === body!.username)
            return state
        if (path === 'logout' && !state.authenticated) {
            auth.resetIdentity('logout')
            return
        }
        let generation = auth.generation
        try {
            await http.auth(path, body, state.csrfToken)
        } catch (error) {
            if (generation !== auth.generation) throw createAdminSessionChangedError()
            // CSRF 拒绝发生在业务执行前；只对此类明确未执行的请求恢复一次。
            if (!isCsrfFailure(getAdminRequestFailure(error))) throw error
            state = await loadSession()
            generation = auth.generation
            if (path === 'login' && state.authenticated && state.user?.username === body!.username)
                return state
            if (path !== 'logout' || state.authenticated)
                await http.auth(path, body, state.csrfToken)
        }
        if (generation !== auth.generation) throw createAdminSessionChangedError()
        auth.resetIdentity(path === 'login' ? 'login' : path === 'logout' ? 'logout' : 'password-change')
        if (path === 'login') return loadSession()
    }

    function write(...args: AuthWrite) {
        return coordinateSession(() => performWrite(...args))
    }

    // 秘密仅作为请求参数；登录后的身份读取由同一请求入口完成。
    async function login(body: AdminLoginRequest) {
        return (await write('login', body))!
    }

    async function download(path: string, body: object) {
        const generation = auth.generation
        if (!auth.session?.authenticated || !auth.session.csrfToken) {
            const state = await refreshSession()
            if (generation !== auth.generation) throw createAdminSessionChangedError()
            if (!state.authenticated) {
                auth.markExpired(returnTo())
                throw createLocalAdminFailure('UNAUTHENTICATED')
            }
        }
        try {
            const result = await http.download(path, body, auth.session!.csrfToken)
            if (generation !== auth.generation) throw createAdminSessionChangedError()
            return result
        } catch (error) {
            const data = (error as {data?: unknown}).data
            if (data instanceof Blob) {
                let parsed: unknown
                try { parsed = JSON.parse(await data.text()) } catch { throw error }
                const failure = {data: parsed}
                await handleFailure(failure, generation)
                throw failure
            }
            await handleFailure(error, generation)
            throw error
        }
    }

    return {
        refreshSession, write, login, download, upload,
        read,
        mutate,
        refreshPermissions,
        message,
        operationMessage,
        handleFailure
    }
})
