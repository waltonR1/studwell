// 公开端 GET /api/public/news 路由入口，衔接请求处理与业务服务。
import {getQuery} from 'h3'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {createPublicNewsService} from '../../../services/public-news'
export default defineApiHandler(async event=>{const service=createPublicNewsService(getDatabase());return service.list(getQuery(event))})
