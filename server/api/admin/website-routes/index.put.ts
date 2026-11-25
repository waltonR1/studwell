// 管理端 PUT /api/admin/website-routes 路由入口，衔接请求处理与业务服务。
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {authMeta,requestActor} from '../../../http/auth'
import {defineApiHandler} from '../../../http/handler'
import {parseJsonBody} from '../../../http/validation'
import {mutateWebsiteRouteNode,routeNodeMutationSchema} from '../../../services/website-route-tree'
export default defineApiHandler(async event=>{
 const actor=await requestActor(event,authRuntime().service)
 return mutateWebsiteRouteNode(getDatabase(),actor,await parseJsonBody(event,routeNodeMutationSchema),authMeta(event))
})
