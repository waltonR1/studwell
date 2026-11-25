// 菜单纵向接口，沿用默认认证/RBAC/CSRF 守卫。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {menuHandlers} from '../../../http/handlers/menu-handlers'

export default defineEventHandler(event => menuHandlers(getDatabase(), authRuntime().options).create(event))
