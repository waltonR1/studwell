// 固定任务API：默认认证/CSRF/RBAC守卫先执行，Service再复核操作权限。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {taskHandlers} from '../../../http/handlers/task-handlers'

export default defineEventHandler(event => taskHandlers(getDatabase(), authRuntime().options, !import.meta.dev && process.env.NODE_ENV !== 'test').record(event))
