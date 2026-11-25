// 协调模板修订、校验和管理操作，模板定义由数据库保存。
import {projectPageCapabilities} from './website-navigation-providers'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {websiteRendererPaths} from './website-renderers'
import type {Database} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {websiteTemplateRepository as repo} from '../repositories/website-templates'
import {mediaRepository} from '../repositories/media'
import {websiteTemplateCatalog} from './website-template-catalog'
import {requirePermission} from './access/permissions'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {websiteTemplateDeleteSchema,websiteTemplateUpdateSchema} from '#shared/schemas/admin/website-pages'
import {entityIdSchema} from '#shared/schemas/entity'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'
import {lockSiteConfig} from '../repositories/website-site-config'
import {removeWebsiteRenderer} from '../repositories/website-renderers'

const invalid=(path:string,message:string)=>new ApiError('INVALID_INPUT',[{path,message}])
export function createWebsiteTemplatesService(db:Database){return {
 async sample(actor:bigint,key:string){await requirePermission(db,actor,'content.templates.read');const revision=await repo.latestRevisionForKey(db,key);if(!revision)throw new ApiError('NOT_FOUND');const sample=await repo.sample(db,key);const {policy}=await readWebsiteModulePolicy(db);return sample?{...sample,view:{...sample.view,structure:projectPageCapabilities(policy,sample.view.structure)},settings:{...sample.settings,pages:Object.fromEntries(Object.entries(sample.settings.pages).map(([key,page])=>[key,projectPageCapabilities(policy,page)]))},previewRendererPath:(await websiteRendererPaths(db,'preview'))(revision.definition.previewRendererId)}:null},
 async read(actor:bigint){await requirePermission(db,actor,'content.templates.read');return websiteTemplateCatalog(db)},
 async update(actor:bigint,id:string,raw:unknown,meta:AuthMeta){
  const input=await parseInput(websiteTemplateUpdateSchema,raw),templateId=BigInt(await parseInput(entityIdSchema,id))
  return auditedWrite(db,{actor,meta,action:'website.template.update',id:templateId,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
   await requirePermission(tx,actor,'content.templates.update')
   // 与删除命令一致，先锁模板，再按媒体 ID 顺序维护封面引用。
   const registered=await repo.find(tx,templateId)
   if(!registered)throw new ApiError('NOT_FOUND')
   if(registered.metadataVersion!==input.version)throw conflictError('STALE','version')
   if(input.enabledForNew&&!await repo.hasRevision(tx,templateId))throw invalid('content','历史遗留模板不能用于新装配。')
   const coverMediaId=input.coverMediaId?BigInt(input.coverMediaId):null
   if(coverMediaId){
    const media=await mediaRepository.find(tx,coverMediaId)
    if(!media||media.kind!=='image')throw invalid('coverMediaId','请选择媒体库中的图片')
   }
   try{await mediaRepository.replaceReferences(tx,`website:template:${templateId}`,coverMediaId?[{mediaId:coverMediaId,field:'cover'}]:[])}
   catch(error){
    if(error instanceof Error&&error.message==='MEDIA_REFERENCE_NOT_FOUND')throw invalid('coverMediaId','选中的图片已被删除，请重新选择')
    throw error
   }
   if(!await repo.update(tx,templateId,input.version,{coverMediaId,name:input.name,description:input.description,enabledForNew:input.enabledForNew,updatedBy:actor,updatedAt:new Date()}))throw conflictError('STALE','version')
   return {id:templateId,name:input.name,changes:auditChanges('site_settings',{}, {settingsFields:'模板目录资料'}),value:await websiteTemplateCatalog(tx)}
  })
 },
 async remove(actor:bigint,id:string,raw:unknown,meta:AuthMeta){
  const input=await parseInput(websiteTemplateDeleteSchema,raw),templateId=BigInt(await parseInput(entityIdSchema,id))
  return auditedWrite(db,{actor,meta,action:'website.template.delete',id:templateId,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
   await requirePermission(tx,actor,'content.templates.update')
   await lockSiteConfig(tx)
   const registered=await repo.find(tx,templateId)
   if(!registered)throw new ApiError('NOT_FOUND')
   if(registered.metadataVersion!==input.version)throw conflictError('STALE','version')
   if(registered.enabledForNew)throw invalid('enabledForNew','请先禁用模板，再删除。')
   if(await repo.hasSections(tx,templateId))throw invalid('content','模板仍有工作区块引用，不能删除目录记录。')
   if((await repo.publishedReferences(tx,registered.key)).length)throw invalid('content','模板仍被当前发布页面引用，请先调整并发布页面或下线页面。')
   if(await repo.historicalReferences(tx,registered.key))throw invalid('content','发布历史仍引用此模板，请先清理相关历史版本。')
   const definitions=(await repo.revisions(tx)).filter(row=>row.templateId===templateId).map(row=>row.definition)
   await mediaRepository.removeReferencesForOwners(tx,[`website:template:${templateId}`])
   if(!await repo.remove(tx,templateId,input.version))throw conflictError('STALE','version')
   const remaining=await repo.revisions(tx)
   for(const scope of ['public','preview'] as const){
    const field=scope==='public'?'publicRendererId':'previewRendererId'
    for(const key of new Set(definitions.map(definition=>definition[field])))if(!remaining.some(row=>row.definition[field]===key))await removeWebsiteRenderer(tx,scope,key)
   }
   return {id:templateId,name:registered.name,changes:auditChanges('site_settings',{}, {settingsFields:'删除历史模板目录记录'}),value:await websiteTemplateCatalog(tx)}
  })
 },
}}
