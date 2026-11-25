// 适配官网资源发布与历史的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getRouterParam,getQuery,setResponseHeader} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createWebsitePublishingService} from '../../services/website-publishing'
import {websiteResourceKeySchema,websitePublishSchema,websiteRestoreSchema} from '#shared/schemas/admin/website'
import {entityIdSchema} from '#shared/schemas/entity'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody} from '../validation'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
export function websiteResourceHandlers(db:Database,options:AuthHttpOptions){
 const auth=createAuthService(db),service=createWebsitePublishingService(db)
 return {read:defineApiHandler(async event=>{const actor=await requestActor(event,auth),key=await parseInput(websiteResourceKeySchema,getRouterParam(event,'key'));await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');const id=getRouterParam(event,'id');return id?service.detail(actor,key,await parseInput(entityIdSchema,id)):service.history(actor,key)}),publish:defineApiHandler(async event=>service.publish(await requestActor(event,auth),await parseInput(websiteResourceKeySchema,getRouterParam(event,'key')),await parseJsonBody(event,websitePublishSchema),authMeta(event,options))),restore:defineApiHandler(async event=>service.restore(await requestActor(event,auth),await parseInput(websiteResourceKeySchema,getRouterParam(event,'key')),await parseJsonBody(event,websiteRestoreSchema),authMeta(event,options)))}
}
