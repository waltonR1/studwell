// 管理端 DELETE /api/admin/news/articles/[id] 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../../runtime/auth'
import {newsHandlers} from '../../../../../http/handlers/news-handlers'
export default defineEventHandler(event=>newsHandlers(getDatabase(),authRuntime().options).remove(event))
