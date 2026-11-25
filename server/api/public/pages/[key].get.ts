// 公开端 GET /api/public/pages/[key] 路由入口，衔接请求处理与业务服务。
import {getQuery, getRouterParam} from 'h3'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {publicWebsitePage} from '../../../services/public-website-page'

export default defineApiHandler(event => publicWebsitePage(getDatabase(), getRouterParam(event, 'key'), getQuery(event)))
