// 管理端 GET /api/admin/environment 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '../../db'
import {environmentHandlers} from '../../http/handlers/environment-handlers'

export default defineEventHandler(event => environmentHandlers(getDatabase()).overview(event))
