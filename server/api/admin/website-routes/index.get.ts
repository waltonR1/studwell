// 管理端 GET /api/admin/website-routes 路由入口，衔接请求处理与业务服务。
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {requestActor} from '../../../http/auth'
import {defineApiHandler} from '../../../http/handler'
import {readWebsiteRouteTree} from '../../../services/website-route-tree'
export default defineApiHandler(async event=>{
 const actor=await requestActor(event,authRuntime().service)
 return readWebsiteRouteTree(getDatabase(),actor)
})
