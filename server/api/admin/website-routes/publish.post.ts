// 管理端 POST /api/admin/website-routes/publish 路由入口，衔接请求处理与业务服务。
import {parseJsonBody} from '../../../http/validation'
import {siteConfigVersionSchema} from '#shared/schemas/admin/website-site-config'
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {authMeta,requestActor} from '../../../http/auth'
import {defineApiHandler} from '../../../http/handler'
import {publishWebsiteRouteTree} from '../../../services/website-route-tree'
export default defineApiHandler(async event=>{
 const actor=await requestActor(event,authRuntime().service)
 return publishWebsiteRouteTree(getDatabase(),actor,await parseJsonBody(event,siteConfigVersionSchema),authMeta(event))
})
