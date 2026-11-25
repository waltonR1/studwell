// 管理端请求认证拦截入口，装配认证依赖并调用 HTTP 守卫。
// /api/admin 默认保护；拒绝使用统一响应，放行时不生成成功响应截断路由。
import {defineEventHandler} from 'h3'
import {guardAdminRequest} from '../http/auth'
import {authRuntime} from '../runtime/auth'
import {apiErrorResponse} from '../http/handler'
import {ensureRequestId} from '../http/request-id'

export default defineEventHandler(async event => {
    const path=event.path.split('?')[0]??''
    if (!/^\/api\/admin(?:\/|$)/.test(path)) return
    ensureRequestId(event)
    try {
        const {service, options, rbac} = authRuntime()
        await guardAdminRequest(event, service, options, rbac.authorize)
    } catch (error) {
        return apiErrorResponse(event, error)
    }
})
