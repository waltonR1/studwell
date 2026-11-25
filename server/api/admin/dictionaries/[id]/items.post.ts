// 管理端 POST /api/admin/dictionaries/[id]/items 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {authRuntime} from '#server/runtime/auth.ts'
import {getDatabase} from '#server/db'
import {dictionaryHandlers} from '#server/http/handlers/dictionary-handlers.ts'

export default defineEventHandler(event => dictionaryHandlers(getDatabase(), authRuntime().options).createItem(event))
