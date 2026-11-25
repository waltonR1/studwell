// 管理端 PUT /api/admin/menus/[id]/move 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '#server/runtime/auth.ts'
import {menuHandlers} from '#server/http/handlers/menu-handlers.ts'

export default defineEventHandler(event => menuHandlers(getDatabase(), authRuntime().options).move(event))
