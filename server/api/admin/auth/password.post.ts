// 本人认证路由，统一默认守卫已先行执行。
import {defineEventHandler} from 'h3'
import {authRuntime} from '../../../runtime/auth'
import {authHandlers} from '../../../http/handlers/auth-handlers'

export default defineEventHandler(event => {
    const {service, options} = authRuntime()
    return authHandlers(service, options).password(event)
})
