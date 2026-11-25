// 公开端 GET /api/public/news/[slug] 路由入口，衔接请求处理与业务服务。
import {getQuery,getRouterParam} from 'h3'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {createPublicNewsService} from '../../../services/public-news'
export default defineApiHandler(async event=>{const service=createPublicNewsService(getDatabase());return service.detail(getRouterParam(event,'slug')!,getQuery(event))})
