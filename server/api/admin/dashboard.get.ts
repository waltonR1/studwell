// 管理端 GET /api/admin/dashboard 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '../../db'
import {dashboardHandlers} from '../../http/handlers/dashboard-handlers'

export default defineEventHandler(event => dashboardHandlers(getDatabase()).overview(event))
