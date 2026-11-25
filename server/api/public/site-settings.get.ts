// 公开端 GET /api/public/site-settings 路由入口，衔接请求处理与业务服务。
import {getQuery} from 'h3'
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../http/handler'
import {publicSiteSettings} from '../../services/public-site-settings'

export default defineApiHandler(event => publicSiteSettings(getDatabase(), getQuery(event)))
