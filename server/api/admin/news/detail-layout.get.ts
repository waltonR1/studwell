// 管理端 GET /api/admin/news/detail-layout 路由入口，衔接请求处理与业务服务。
import {getQuery,setResponseHeader} from 'h3'
import {getDatabase} from '#server/db'
import {createAuthService} from '../../../services/auth'
import {requestActor} from '../../../http/auth'
import {defineApiHandler} from '../../../http/handler'
import {previewNewsArticleLayout} from '../../../services/news-article-layout-preview'
export default defineApiHandler(async event=>{
 const db=getDatabase(),auth=createAuthService(db)
 const actor=await requestActor(event,auth)
 setResponseHeader(event,'Cache-Control','private, no-store')
 return previewNewsArticleLayout(db,actor,getQuery(event))
})
