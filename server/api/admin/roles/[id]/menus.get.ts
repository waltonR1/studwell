// 菜单纵向接口，沿用默认认证/RBAC/CSRF 守卫。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '#server/runtime/auth.ts'
import {roleHandlers} from '#server/http/handlers/role-handlers.ts'

export default defineEventHandler(event => roleHandlers(getDatabase(), authRuntime().options).roleMenus(event))
