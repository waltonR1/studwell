// 公开端 POST /api/public/inquiries 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {publicInquiryHandler} from '../../../http/handlers/public-inquiry-handler'
import {authRuntime} from '../../../runtime/auth'

export default defineEventHandler(event => publicInquiryHandler(getDatabase(), authRuntime().options)(event))
