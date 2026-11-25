// 管理端 GET /api/admin/website-templates/[key]/sample 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../runtime/auth'
import {websiteTemplateHandlers} from '../../../../http/handlers/website-template-handlers'
export default defineEventHandler(event=>websiteTemplateHandlers(getDatabase(),authRuntime().options).sample(event))
