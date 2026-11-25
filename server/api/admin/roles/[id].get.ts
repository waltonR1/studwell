// 角色接口，默认认证/RBAC/CSRF 守卫先行执行。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {roleHandlers} from '../../../http/handlers/role-handlers'

export default defineEventHandler(event => roleHandlers(getDatabase(), authRuntime().options).detail(event))
