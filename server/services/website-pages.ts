// 协调官网页面与区块业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {sectionContentSchema} from '#shared/schemas/website/section-content'
import {readPublishedRoutes} from '../repositories/website-route-tree'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {websitePageRepository as repo} from '../repositories/website-pages'
import {mediaRepository} from '../repositories/media'
import {requirePermission} from './access/permissions'
import {emptyPageSettings,normalizeSectionPlacement,templateSupportsPage} from '#shared/utils/website/page-layouts'
import {authorizePageScope,pageMenu} from './website-access'
import {authorizeWebsite} from './website-access'
import {resourcePublication} from './website-read-model'
import {snapshotMedia} from '../policies/website-media'
import {websitePageUpdateSchema, websiteSectionUpdateSchema} from '#shared/schemas/admin/website-pages'
import type {WebsitePageRecord} from '#shared/types/admin/website'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'
import {websiteTemplates,templateBusinessModules} from './website-template-catalog'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {assertSectionMedia} from './website-section-media'
import {insertSection,placeSection,removeSection} from './website-section-assembly'
import {validateSettings,validateSectionOrdering} from '../policies/website-pages'
import {sectionTemplateUpgradeSchema} from '#shared/schemas/admin/template-maintenance'
import {lockSiteConfig} from '../repositories/website-site-config'
const invalid=(message:string)=>new ApiError('INVALID_INPUT',[{path:'content',message}])

async function syncMedia(db:DatabaseExecutor,owner:string,content:unknown){
 try{await mediaRepository.replaceReferences(db,owner,snapshotMedia(content))}
 catch(error){if(error instanceof Error&&error.message==='MEDIA_REFERENCE_NOT_FOUND')throw invalid('选中的媒体已不存在，请重新选择。');throw error}
}
export function createWebsitePagesService(db:Database){
 async function read(tx:DatabaseExecutor,actor:bigint,key:string):Promise<WebsitePageRecord>{
  await requirePermission(tx,actor,'content.pages.read');await authorizePageScope(tx,actor,key)
  const menu=await pageMenu(tx,key),r=await resources.find(tx,`page.${key}`)
  const templates=(await websiteTemplates(tx)).filter(t=>t.definition&&templateSupportsPage(t.definition,key))
  if(!r)return {resourceId:null,persisted:false,scopeGranted:true,key,name:menu.name,resourceKey:`page.${key}`,routePath:null,version:1,settingsVersion:1,settings:emptyPageSettings(),sections:[],templates,publication:{stateVersion:1,status:'unpublished',changed:false,draftVersion:1,publishedReleaseId:null,publishedDraftVersion:null,releases:[]},updatedAt:'',updatedBy:String(actor)}
  await authorizeWebsite(tx,actor,r,'read');const draft=await resources.draft(tx,r.id);if(!draft)throw new ApiError('NOT_FOUND')
  const settings=websitePageSettingsSchema.parse(draft.content),sections=(await resources.sections(tx,r.id)).map(({section:s,template:t,revision})=>({id:String(s.id),templateId:String(t.id),templateKey:t.key,name:s.instanceName??t.name,sortOrder:s.sortOrder,visible:s.visible,anchorKey:s.anchorKey,contentVersion:s.contentVersion,structureVersion:s.structureVersion,shared:websiteSectionUpdateSchema.shape.shared.parse(s.sharedContent),localized:s.localizedContent,definition:revision.definition}))
  const {policy}=await readWebsiteModulePolicy(tx)
  return {resourceId:String(r.id),persisted:true,scopeGranted:true,key,name:menu.name,resourceKey:r.key,routePath:(await readPublishedRoutes(tx)).find(route=>route.resourceId===r.id)?.path??null,version:r.draftVersion,settingsVersion:draft.settingsVersion,settings,sections:normalizeSectionPlacement(sections).map(section=>({...section,businessModules:templateBusinessModules(policy,section.templateKey)})),templates,publication:await resourcePublication(tx,r),updatedAt:r.updatedAt.toISOString(),updatedBy:String(r.updatedBy)}
 }
 return {
  read:(actor:bigint,key:string)=>db.transaction(tx=>read(tx,actor,key),{isolationLevel:'repeatable read'}),
  async settings(actor:bigint,key:string,raw:unknown,meta:AuthMeta){
   const input=await parseInput(websitePageUpdateSchema,raw)
   input.sections=normalizeSectionPlacement(input.sections)
   validateSectionOrdering(input.sections)
   return auditedWrite(db,{actor,meta,action:'website.settings.update',id:null,targetType:'site_settings',targetName:key,isolationLevel:'read committed'},async tx=>{
    await requirePermission(tx,actor,'content.pages.update');await authorizePageScope(tx,actor,key)
    const menu=await pageMenu(tx,key,true)
    let r=await resources.find(tx,`page.${key}`,true)
    validateSettings(key,input.settings)
    if(!r){
     if(input.version!==1||input.removed.length||input.sections.some(s=>!s.id.startsWith('new_')))throw conflictError('STALE','version')
     const id=await repo.create(tx,key,actor);await repo.createDraft(tx,id,emptyPageSettings(),actor);r=(await resources.find(tx,`page.${key}`,true))!
    }
    await authorizeWebsite(tx,actor,r,'update')
    const currentDraft=await resources.draft(tx,r.id);if(currentDraft?.settingsVersion!==input.version)throw conflictError('STALE','version')
    const previous=await resources.sections(tx,r.id),catalog=await websiteTemplates(tx)
    const all=input.sections.map(s=>s.id);if(new Set(all).size!==all.length||new Set(input.sections.map(s=>s.anchorKey)).size!==all.length)throw invalid('实例或锚点不能重复。')
    for(const old of previous){const s=old.section;if(!all.includes(String(s.id))&&!input.removed.some(x=>x.id===String(s.id)))throw invalid('删除实例需要明确确认。')}
    for(const item of input.removed){const old=previous.find(x=>String(x.section.id)===item.id)?.section;if(!old||old.contentVersion!==item.contentVersion||all.includes(item.id))throw conflictError('STALE','contentVersion')}
    if(!await repo.settings(tx,r.id,input.version,input.settings,actor))throw conflictError('STALE','version')
    for(const item of input.sections){
     const existing=previous.find(x=>String(x.section.id)===item.id)
     const template=catalog.find(t=>t.id===item.templateId),def=existing?existing.revision.definition:template?.definition;if(!template||!def||!templateSupportsPage(def,key))throw invalid('所选模板不适用于当前页面布局。')
     if(template.key!==item.templateKey)throw invalid('区块模板编码不匹配。')
     const old=existing?.section
     if(old){if(String(old.templateId)!==item.templateId||old.anchorKey!==item.anchorKey)throw invalid('实例模板和锚点不允许直接替换。');const changed=['sortOrder','visible'].some(k=>(old as unknown as Record<string,unknown>)[k]!== (item as Record<string,unknown>)[k]);if(changed)await placeSection(tx,actor,old.id,item.structureVersion,{sortOrder:item.sortOrder,visible:item.visible})}
      else {if(!item.id.startsWith('new_')||!template.enabledForNew||template.revision==null)throw invalid('模板不可用于新装配。');await insertSection(tx,actor,r.id,BigInt(item.templateId),template.revision,def,{instanceName:item.name??template.name,sortOrder:item.sortOrder,visible:item.visible,anchorKey:item.anchorKey})}
    }
    for(const item of input.removed){
     await removeSection(tx,BigInt(item.id))
    }
    if(!await resources.bump(tx,r.id,actor))throw conflictError('STALE','version')
    return {id:r.id,name:menu.name,changes:auditChanges('site_settings',{}, {settingsFields:'页面设置与装配',settingsVersion:r.draftVersion+1}),value:await read(tx,actor,key)}
   })
  },
  async upgrade(actor:bigint,key:string,id:string,raw:unknown,meta:AuthMeta){
   const sectionId=BigInt(await parseInput(entityIdSchema,id)),input=await parseInput(sectionTemplateUpgradeSchema,raw)
   return auditedWrite(db,{actor,meta,action:'website.section.upgrade',id:sectionId,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
    await lockSiteConfig(tx)
    const r=await resources.find(tx,`page.${key}`,true);if(!r)throw new ApiError('NOT_FOUND')
    await authorizeWebsite(tx,actor,r,'update')
    const item=(await resources.sections(tx,r.id)).find(item=>item.section.id===sectionId)
    if(!item)throw new ApiError('NOT_FOUND')
    const latest=(await websiteTemplates(tx)).find(template=>template.id===String(item.template.id))
    if(!latest?.definition||latest.revision!==input.revision||item.section.templateRevision>=input.revision)throw conflictError('STALE','revision')
    if(!templateSupportsPage(latest.definition,key))throw invalid('新修订不适用于当前页面。')
    for(const value of Object.values(item.section.localizedContent))await parseInput(sectionContentSchema(latest.definition.fields),value)
    await assertSectionMedia(tx,latest.definition,item.section.sharedContent,item.section.localizedContent)
    if(!await repo.replaceTemplate(tx,sectionId,input.contentVersion,input.structureVersion,{templateRevision:input.revision,updatedBy:actor,updatedAt:new Date()}))throw conflictError('STALE','version')
    if(!await resources.bump(tx,r.id,actor))throw conflictError('STALE','version')
    return {id:sectionId,name:item.template.name,changes:auditChanges('site_settings',{}, {settingsFields:'升级区块模板修订',settingsVersion:input.revision}),value:await read(tx,actor,key)}
   })
  },
  async section(actor:bigint,key:string,id:string,raw:unknown,meta:AuthMeta){
   const sectionId=BigInt(await parseInput(entityIdSchema,id)),input=await parseInput(websiteSectionUpdateSchema,raw)
   return auditedWrite(db,{actor,meta,action:'website.section.update',id:sectionId,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
    const r=await resources.find(tx,`page.${key}`,true);if(!r)throw new ApiError('NOT_FOUND');await authorizeWebsite(tx,actor,r,'update')
    const draft=await resources.draft(tx,r.id);if(!draft)throw new ApiError('NOT_FOUND')
    const sections=await resources.sections(tx,r.id)
    const item=sections.find(x=>x.section.id===sectionId);if(!item)throw new ApiError('NOT_FOUND')
    const def=item.revision.definition
    if(!templateSupportsPage(def,key))throw invalid('模板不可用。')
    const localized=Object.fromEntries(await Promise.all(Object.entries(input.localized).map(async ([l,value])=>[l,await parseInput(sectionContentSchema(def.fields),value)])))
    await assertSectionMedia(tx,def,input.shared,localized)
    if(!await repo.content(tx,sectionId,input.contentVersion,input.structureVersion,{instanceName:input.name??item.section.instanceName,sharedContent:input.shared,localizedContent:localized,updatedBy:actor,updatedAt:new Date()}))throw conflictError('STALE','contentVersion')
    await syncMedia(tx,`website:section:${id}`,{shared:input.shared,localized})
    if(!await resources.bump(tx,r.id,actor))throw conflictError('STALE','version')
    return {id:sectionId,name:item.template.name,changes:auditChanges('site_settings',{}, {settingsFields:item.template.name,settingsVersion:r.draftVersion+1}),value:await read(tx,actor,key)}
   })
  },

 }
}
