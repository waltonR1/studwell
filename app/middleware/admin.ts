// 页面体验守卫；服务端 API 默认保护仍独立执行。
import {useAdminRequestStore} from '~/stores/admin/request'
import {useAdminSessionStore} from '~/stores/admin/session'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import {safeAdminRedirect} from '~/utils/admin/auth/redirect'

export default defineNuxtRouteMiddleware(async to => {
    if (import.meta.client && useNuxtApp().isHydrating) return
    const request = useAdminRequestStore()
    const session = useAdminSessionStore()
    const target = safeAdminRedirect(to.fullPath)
    let state
    try {
        state = await request.refreshSession()
    } catch {
        return abortNavigation(createError({statusCode: 503, message: '管理端暂不可用，请检查服务配置和迁移'}))
    }
    if (!state.authenticated) {
        if (to.path !== '/admin/login') return navigateTo({path: '/admin/login', query: {redirect: target}})
        return
    }
    if (state.mustChangePassword) {
        if (to.path !== '/admin/change-password') return navigateTo({
            path: '/admin/change-password',
            query: {redirect: target}
        })
    } else if (to.path === '/admin/login') return navigateTo(safeAdminRedirect(to.query.redirect))
    const permission=typeof to.meta.adminPermission==='function'?to.meta.adminPermission(to.query):to.meta.adminPermission
    if (permission) {
        try {
            await request.refreshPermissions(target)
        } catch (error) {
            const failure = getAdminRequestFailure(error)
            if (failure?.code === 'UNAUTHENTICATED') return navigateTo({
                path: '/admin/login',
                query: {redirect: target}
            })
            if (failure?.code === 'PASSWORD_CHANGE_REQUIRED') return navigateTo({
                path: '/admin/change-password',
                query: {redirect: target}
            })
            return abortNavigation(createError({statusCode: 503, message: '权限读取失败，请重试'}))
        }
        if (!session.can(permission)) return navigateTo({
            path: '/admin/forbidden',
            query: {from: target}
        })
    }
})
