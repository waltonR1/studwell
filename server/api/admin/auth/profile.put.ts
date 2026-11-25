// 管理端 PUT /api/admin/auth/profile 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {authRuntime} from '../../../runtime/auth'
import {getDatabase} from '#server/db'
import {personalProfileHandlers} from '../../../http/handlers/personal-profile-handlers'

export default defineEventHandler(event => {
    const {options} = authRuntime()
    return personalProfileHandlers(getDatabase(), options).update(event)
})
