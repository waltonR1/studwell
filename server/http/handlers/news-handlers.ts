// 适配新闻的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery,getRouterParam,setResponseHeader} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createNewsService} from '../../services/news'
import {createAuthService} from '../../services/auth'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody} from '../validation'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
import {entityIdSchema} from '#shared/schemas/entity'
import {websiteRestoreSchema,websiteWithdrawSchema} from '#shared/schemas/admin/website'
import {newsOperationsUpdateSchema,newsCategorySaveSchema,newsCategoryMoveSchema,newsArticleCreateSchema,newsArticleUpdateSchema,newsPublicationInputSchema,newsRestoreSchema,newsVersionSchema} from '#shared/schemas/admin/news'
export function newsHandlers(db:Database,options:AuthHttpOptions){
 const auth=createAuthService(db),service=createNewsService(db)
 const id=(event:Parameters<typeof getRouterParam>[0])=>parseInput(entityIdSchema,getRouterParam(event,'id'))
 return {
  categories:defineApiHandler(async event=>{await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');return service.categories(await requestActor(event,auth))}),
  categorySave:defineApiHandler(async event=>{
   const actor=await requestActor(event,auth)
   const {id:categoryId,...input}=await parseJsonBody(event,newsCategorySaveSchema)
   return service.categorySave(actor,categoryId,input,authMeta(event,options))
  }),
  categoryMove:defineApiHandler(async event=>service.categoryMove(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsCategoryMoveSchema),authMeta(event,options))),
  categoryDelete:defineApiHandler(async event=>service.categoryDelete(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsVersionSchema),authMeta(event,options))),
  list:defineApiHandler(async event=>{setResponseHeader(event,'Cache-Control','private, no-store');return service.list(await requestActor(event,auth),getQuery(event))}),
  detail:defineApiHandler(async event=>{await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');return service.detail(await requestActor(event,auth),await id(event))}),
  create:defineApiHandler(async event=>service.save(await requestActor(event,auth),null,await parseJsonBody(event,newsArticleCreateSchema),authMeta(event,options))),
  update:defineApiHandler(async event=>service.save(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsArticleUpdateSchema),authMeta(event,options))),
  publish:defineApiHandler(async event=>service.publish(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsPublicationInputSchema),authMeta(event,options))),
  restore:defineApiHandler(async event=>service.publish(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsRestoreSchema),authMeta(event,options),true)),
  withdraw:defineApiHandler(async event=>service.withdraw(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsPublicationInputSchema),authMeta(event,options))),
  remove:defineApiHandler(async event=>service.remove(await requestActor(event,auth),await id(event),await parseJsonBody(event,newsPublicationInputSchema),authMeta(event,options))),
  release:defineApiHandler(async event=>{await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');return service.release(await requestActor(event,auth),await id(event),await parseInput(entityIdSchema,getRouterParam(event,'releaseId')))}),
  overview:defineApiHandler(async event=>{
   await parseInput(z.strictObject({}),getQuery(event))
   setResponseHeader(event,'Cache-Control','private, no-store')
   return service.overview(await requestActor(event,auth))
  }),
  operations:defineApiHandler(async event=>{
   await parseInput(z.strictObject({}),getQuery(event))
   setResponseHeader(event,'Cache-Control','private, no-store')
   return service.operations(await requestActor(event,auth))
  }),
  saveOperations:defineApiHandler(async event=>service.saveOperations(
   await requestActor(event,auth),
   await parseJsonBody(event,newsOperationsUpdateSchema),
   authMeta(event,options),
  )),
  reopen:defineApiHandler(async event=>{
   const actor=await requestActor(event,auth)
   const input=await parseJsonBody(event,websiteRestoreSchema.partial({releaseId:true}).extend({publishedReleaseId:z.null()}))
   return service.reopen(actor,input,authMeta(event,options))
  }),
  withdrawAll:defineApiHandler(async event=>service.withdrawAll(
   await requestActor(event,auth),
   await parseJsonBody(event,websiteWithdrawSchema),
   authMeta(event,options),
  )),
 }
}
