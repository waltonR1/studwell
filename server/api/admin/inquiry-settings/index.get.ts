// 管理端 GET /api/admin/inquiry-settings 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {inquirySettingsHandler} from '../../../http/handlers/inquiry-settings-handlers'
import {authRuntime} from '../../../runtime/auth'
import {inquiryTransportConfigured} from '../../../runtime/inquiries'

export default defineEventHandler(event => inquirySettingsHandler(
    getDatabase(), authRuntime().options, 'get', inquiryTransportConfigured(event),
)(event))
