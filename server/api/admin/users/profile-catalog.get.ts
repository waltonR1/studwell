// 账号资料表单消费部门、岗位字典；权限由账号查看能力裁决。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {userHandlers} from '../../../http/handlers/user-handlers'

export default defineEventHandler(event => userHandlers(getDatabase(), authRuntime().options, false).profileCatalog(event))
