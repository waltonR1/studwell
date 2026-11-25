// 管理端 POST /api/admin/dictionaries 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {authRuntime} from '../../../runtime/auth'
import {getDatabase} from '#server/db'
import {dictionaryHandlers} from '../../../http/handlers/dictionary-handlers'

export default defineEventHandler(event => dictionaryHandlers(getDatabase(), authRuntime().options).create(event))
