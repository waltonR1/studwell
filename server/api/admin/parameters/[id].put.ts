// 管理端 PUT /api/admin/parameters/[id] 路由入口，衔接请求处理与业务服务。
import { defineEventHandler } from 'h3'
import { authRuntime } from '../../../runtime/auth'
import { getDatabase } from '#server/db'
import { parameterHandlers } from '../../../http/handlers/parameter-handlers'
export default defineEventHandler(event => parameterHandlers(getDatabase(), authRuntime().options).update(event))
