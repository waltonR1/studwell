// 管理端 POST /api/admin/website-resources/[key]/publish 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../runtime/auth'
import {websiteResourceHandlers} from '../../../../http/handlers/website-resource-handlers'
export default defineEventHandler(event=>websiteResourceHandlers(getDatabase(),authRuntime().options).publish(event))
