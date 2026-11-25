// 账号接口，认证/RBAC/CSRF 守卫先行，密码策略由数据库参数统一读取。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {userHandlers} from '../../../http/handlers/user-handlers'

export default defineEventHandler(event => userHandlers(getDatabase(), authRuntime().options).detail(event))
