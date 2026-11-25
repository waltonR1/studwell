// 本人有效权限投影：已认证且完成首次改密，不接受外部 userId。
import {defineApiHandler} from '../../../http/handler'
import {authRuntime} from '../../../runtime/auth'
import {readSessionCookie} from '../../../http/auth'
import {ApiError} from '../../../core/errors'

export default defineApiHandler(async event => {
    const {service, rbac} = authRuntime()
    const current = await service.resolve(readSessionCookie(event))
    if (!current?.user) throw new ApiError('UNAUTHENTICATED')
    return rbac.snapshot(current.user.id)
})
