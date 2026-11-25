// 公开端 GET /api/public/site-languages 路由入口，衔接请求处理与业务服务。
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../http/handler'
import {readSiteLanguages} from '../../services/site-languages'

export default defineApiHandler(() => getDatabase().transaction(tx=>readSiteLanguages(tx),{isolationLevel:'repeatable read'}))
