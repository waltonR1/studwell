// 适配官网页面的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {previewWebsitePage} from '../../services/website-page-preview'
import {getRouterParam,getQuery,setResponseHeader} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createWebsitePageDeletionService} from '../../services/website-page-deletion'
import {createWebsitePagesService} from '../../services/website-pages'
import {websitePageDeleteSchema,websitePageUpdateSchema,websiteSectionUpdateSchema} from '#shared/schemas/admin/website-pages'
import {entityIdSchema} from '#shared/schemas/entity'
import {sectionTemplateUpgradeSchema} from '#shared/schemas/admin/template-maintenance'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody} from '../validation'
import {requestActor,authMeta,type AuthHttpOptions} from '../auth'
const pageKey=z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)
export function websitePageHandlers(db:Database,options:AuthHttpOptions){const auth=createAuthService(db),service=createWebsitePagesService(db)
 return {
 upgrade:defineApiHandler(async event=>service.upgrade(await requestActor(event,auth),await parseInput(pageKey,getRouterParam(event,'key')),await parseInput(entityIdSchema,getRouterParam(event,'id')),await parseJsonBody(event,sectionTemplateUpgradeSchema),authMeta(event,options))),
 preview:defineApiHandler(async event=>{const actor=await requestActor(event,auth);setResponseHeader(event,'Cache-Control','private, no-store');return previewWebsitePage(db,actor,await parseInput(pageKey,getRouterParam(event,'key')),getQuery(event))}),
 remove:defineApiHandler(async event=>createWebsitePageDeletionService(db).remove(await requestActor(event,auth),await parseInput(pageKey,getRouterParam(event,'key')),await parseJsonBody(event,websitePageDeleteSchema),authMeta(event,options))),
 read:defineApiHandler(async event=>{const actor=await requestActor(event,auth);await parseInput(z.strictObject({}),getQuery(event));setResponseHeader(event,'Cache-Control','private, no-store');return service.read(actor,await parseInput(pageKey,getRouterParam(event,'key')))}),
 settings:defineApiHandler(async event=>service.settings(await requestActor(event,auth),await parseInput(pageKey,getRouterParam(event,'key')),await parseJsonBody(event,websitePageUpdateSchema,2*1024*1024),authMeta(event,options))),
 section:defineApiHandler(async event=>service.section(await requestActor(event,auth),await parseInput(pageKey,getRouterParam(event,'key')),await parseInput(entityIdSchema,getRouterParam(event,'id')),await parseJsonBody(event,websiteSectionUpdateSchema,2*1024*1024),authMeta(event,options))),
 }
}
