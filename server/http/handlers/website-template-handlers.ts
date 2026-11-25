// 适配区块模板的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getRouterParam,getQuery,setResponseHeader} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createWebsiteTemplatesService} from '../../services/website-templates'
import {createTemplateConfigurationService} from '../../services/template-configuration'
import {templateRegistrationSchema,templateRevisionUpdateSchema} from '#shared/schemas/admin/template-maintenance'
import {websiteTemplateDeleteSchema,websiteTemplateUpdateSchema} from '#shared/schemas/admin/website-pages'
import {entityIdSchema} from '#shared/schemas/entity'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody} from '../validation'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
export function websiteTemplateHandlers(db:Database,options:AuthHttpOptions){
 const auth=createAuthService(db),service=createWebsiteTemplatesService(db)
 const configuration=createTemplateConfigurationService(db)
 return {
  register:defineApiHandler(async event=>configuration.register(await requestActor(event,auth),await parseJsonBody(event,templateRegistrationSchema,2*1024*1024),authMeta(event,options))),
  revise:defineApiHandler(async event=>configuration.revise(await requestActor(event,auth),await parseInput(entityIdSchema,getRouterParam(event,'id')),await parseJsonBody(event,templateRevisionUpdateSchema,2*1024*1024),authMeta(event,options))),
  sample:defineApiHandler(async event=>{await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');return service.sample(await requestActor(event,auth),await parseInput(z.string().min(1).max(100),getRouterParam(event,'key')))}),
  read:defineApiHandler(async event=>{await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');return service.read(await requestActor(event,auth))}),
  update:defineApiHandler(async event=>service.update(await requestActor(event,auth),await parseInput(entityIdSchema,getRouterParam(event,'id')),await parseJsonBody(event,websiteTemplateUpdateSchema),authMeta(event,options))),
  remove:defineApiHandler(async event=>service.remove(await requestActor(event,auth),await parseInput(entityIdSchema,getRouterParam(event,'id')),await parseJsonBody(event,websiteTemplateDeleteSchema),authMeta(event,options))),
 }
}
