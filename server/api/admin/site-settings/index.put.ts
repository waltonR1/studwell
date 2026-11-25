// 管理端 PUT /api/admin/site-settings 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {siteSettingsHandlers} from '../../../http/handlers/site-settings-handlers'
export default defineEventHandler(event => siteSettingsHandlers(getDatabase(), authRuntime().options).update(event))
