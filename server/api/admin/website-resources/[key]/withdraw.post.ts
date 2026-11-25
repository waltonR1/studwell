// 管理端 POST /api/admin/website-resources/[key]/withdraw 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../runtime/auth'
import {websiteWithdrawalHandlers} from '../../../../http/handlers/website-withdrawal-handlers'
export default defineEventHandler(event=>websiteWithdrawalHandlers(getDatabase(),authRuntime().options).withdraw(event))
