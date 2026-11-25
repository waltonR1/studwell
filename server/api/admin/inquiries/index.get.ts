// 管理端 GET /api/admin/inquiries 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {inquiryHandler} from '../../../http/handlers/inquiry-handlers'

export default defineEventHandler(event => inquiryHandler(getDatabase(), authRuntime().options, 'list')(event))
