// 管理端 GET /api/admin/logs/audit 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {authRuntime} from '#server/runtime/auth.ts'
import {getDatabase} from '#server/db'
import {logHandlers} from '#server/http/handlers/log-handlers.ts'

export default defineEventHandler(event => logHandlers(getDatabase(), authRuntime().options, 'audit').list(event))
