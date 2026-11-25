// 账号接口，认证/RBAC/CSRF 守卫先行，密码策略由数据库参数统一读取。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '#server/runtime/auth.ts'
import {userHandlers} from '#server/http/handlers/user-handlers.ts'

export default defineEventHandler(event => userHandlers(getDatabase(), authRuntime().options).roles(event))
