// 后台登记已部署组件与初始合同；配置修订不覆盖原合同，不自动升级工作区块。
import rendererInventory from '#section-renderer-inventory'
import {isDeepStrictEqual} from 'node:util'
import type {Database} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {templateRegistrationSchema,templateRevisionUpdateSchema} from '#shared/schemas/admin/template-maintenance'
import {entityIdSchema} from '#shared/schemas/entity'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {websiteTemplateRepository as repo} from '../repositories/website-templates'
import {insertWebsiteRenderers} from '../repositories/website-renderers'
import {lockSiteConfig} from '../repositories/website-site-config'
import {menuRepository} from '../repositories/menus'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'
import {assertTemplateConfiguration} from '../policies/template-configuration'
import {isWebsiteRendererPath} from './website-renderers'
import {websiteTemplateCatalog} from './website-template-catalog'
import type {SectionTemplateRevision} from '#shared/types/admin/section-template'
import type {DatabaseExecutor} from '../db/transaction'

async function assertPages(tx:DatabaseExecutor,definition:SectionTemplateRevision){
 const pages=new Set((await menuRepository.all(tx)).filter(row=>row.pageKey==='website_page').map(row=>websitePageKey(row.code)))
 const selected=definition.allowedPages==='all'?[]:definition.allowedPages
 if(selected.some(key=>!pages.has(key)))throw new ApiError('INVALID_INPUT',[{path:'definition.allowedPages',message:'请选择已登记的官网页面。'}])
}
export function createTemplateConfigurationService(db:Database){return {
 async register(actor:bigint,raw:unknown,meta:AuthMeta){
  const input=await parseInput(templateRegistrationSchema,raw)
  const definition={...input.definition,publicRendererId:input.definition.key,previewRendererId:input.definition.key}
  if(definition.name.length>100)throw new ApiError('INVALID_INPUT',[{path:'definition.name',message:'登记名称不能超过 100 字。'}])
  if(!/^[a-z][a-z0-9_.-]{0,99}$/.test(definition.key))throw new ApiError('INVALID_INPUT',[{path:'definition.key',message:'模板代称格式无效。'}])
  return auditedWrite(db,{actor,meta,action:'website.template.create',id:null,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
   await requirePermission(tx,actor,'content.templates.update');await lockSiteConfig(tx)
   for(const [scope,path] of [['public',input.publicComponentPath],['preview',input.previewComponentPath]] as const){
    if(!isWebsiteRendererPath(scope,path)||!rendererInventory.includes(path))throw new ApiError('INVALID_INPUT',[{path:scope+'ComponentPath',message:'组件路径不属于当前构建已收录的组件，请确认文件已打包部署。'}])
   }
   assertTemplateConfiguration(definition);await assertPages(tx,definition)
   const id=await repo.insert(tx,actor,definition,input.description)
   await insertWebsiteRenderers(tx,definition.key,input.publicComponentPath,input.previewComponentPath)
   return {id,name:definition.name,changes:auditChanges('site_settings',null,{settingsFields:'登记区块模板',settingsVersion:1}),value:await websiteTemplateCatalog(tx)}
  })
 },
 async revise(actor:bigint,id:string,raw:unknown,meta:AuthMeta){
  const templateId=BigInt(await parseInput(entityIdSchema,id)),input=await parseInput(templateRevisionUpdateSchema,raw)
  return auditedWrite(db,{actor,meta,action:'website.template.revise',id:templateId,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
   await requirePermission(tx,actor,'content.templates.update');await lockSiteConfig(tx)
   const template=await repo.find(tx,templateId)
   if(!template)throw new ApiError('NOT_FOUND')
   const latest=(await repo.revisions(tx)).find(row=>row.templateId===templateId)
   if(template.metadataVersion!==input.version||latest?.version!==input.revision||input.revision>=MAX_ENTITY_VERSION)throw conflictError('STALE','version')
   assertTemplateConfiguration(input.definition,latest.definition);await assertPages(tx,input.definition)
   if(isDeepStrictEqual(input.definition,latest.definition))return {id:templateId,name:template.name,changes:auditChanges('site_settings',{},{}),value:await websiteTemplateCatalog(tx)}
   await repo.appendRevision(tx,templateId,input.revision+1,input.definition)
   if(!await repo.update(tx,templateId,input.version,{updatedBy:actor,updatedAt:new Date()}))throw conflictError('STALE','version')
   return {id:templateId,name:template.name,changes:auditChanges('site_settings',{}, {settingsFields:'保存模板配置修订',settingsVersion:input.revision+1}),value:await websiteTemplateCatalog(tx)}
  })
 },
}}
