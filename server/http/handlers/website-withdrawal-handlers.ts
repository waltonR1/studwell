// 适配官网资源撤回的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getRouterParam} from 'h3'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createWebsitePageWithdrawalService} from '../../services/website-page-withdrawal'
import {websiteWithdrawSchema,websiteResourceKeySchema} from '#shared/schemas/admin/website'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody} from '../validation'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
export function websiteWithdrawalHandlers(db:Database,options:AuthHttpOptions){
 const auth=createAuthService(db),service=createWebsitePageWithdrawalService(db)
 return {withdraw:defineApiHandler(async event=>service.withdraw(await requestActor(event,auth),await parseInput(websiteResourceKeySchema,getRouterParam(event,'key')),await parseJsonBody(event,websiteWithdrawSchema),authMeta(event,options)))}
}
