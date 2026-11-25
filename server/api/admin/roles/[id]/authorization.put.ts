// 管理端 PUT /api/admin/roles/[id]/authorization 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '#server/runtime/auth.ts'
import {roleHandlers} from '#server/http/handlers/role-handlers.ts'

export default defineEventHandler(event => roleHandlers(getDatabase(), authRuntime().options).assignRoleAuthorization(event))
