// 管理端 GET /api/admin/pages/[key] 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../runtime/auth'
import {websitePageHandlers} from '../../../../http/handlers/website-page-handlers'
export default defineEventHandler(event=>websitePageHandlers(getDatabase(),authRuntime().options).read(event))
