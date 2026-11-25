// 管理端 POST /api/admin/careers/positions/[id]/move 路由入口，衔接请求处理与业务服务。
import {defineEventHandler} from 'h3'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../../../runtime/auth'
import {careerHandler} from '../../../../../http/handlers/career-handlers'

export default defineEventHandler(event=>careerHandler(getDatabase(),authRuntime().options,'move')(event))
