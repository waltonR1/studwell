// 公开端 GET /api/public/inquiries/categories 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {publicInquiryCategoriesHandler} from '../../../http/handlers/public-inquiry-handler'

export default defineEventHandler(event => publicInquiryCategoriesHandler(getDatabase())(event))
