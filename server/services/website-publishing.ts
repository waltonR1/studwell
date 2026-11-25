// 协调资源发布、历史版本和相关引用更新事务。
import {assertBasicImagePresentations} from './website-image-rules'
import {validateBusinessSectionContent} from './website-business-validation'
import {sitePageEnabled,siteSnapshotEnabled} from './site-modules'
import {lockSiteConfig} from '../repositories/website-site-config'
import {readSiteLanguages} from './site-languages'
import {sameLinkTarget} from '#shared/utils/website/link-target'
import {lockVisiblePageMenu} from './website-menu-lifecycle'
import {assertPublishedRouteTargets} from './website-route-tree'
import {taskRepository} from '../repositories/tasks'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {websiteResourceRepository as repo} from '../repositories/website-resources'
import {websiteNavigationTargets} from './website-navigation-targets'
import {siteSettingsSchema,type SiteSection} from '#shared/schemas/admin/site-settings'
import {websitePublishSchema,websiteRestoreSchema,websiteResourceKeySchema} from '#shared/schemas/admin/website'
import type {WebsiteReleaseDetail} from '#shared/types/admin/website'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'
import {resourceSnapshot,resourcePublication,releaseMetadata,type WebsiteResource} from './website-read-model'
import {authorizeWebsite} from './website-access'
import {snapshotMedia} from '../policies/website-media'
import {validatePagePublication,snapshotSections} from '../policies/website-pages'
import {publishedNavigationLinks,publishedPageTargets} from '../policies/website-navigation'
import {publishedFieldDefinition} from '../policies/public-website-snapshot'
import {assertSectionMedia} from './website-section-media'
import {mediaRepository} from '../repositories/media'
import {supportsBusinessNavigationTarget} from './website-navigation-providers'
import {publicationLockKeys,assertPublicationDependencies} from './website-publication-guards'
export function createWebsitePublishingService(db:Database){
 async function write(actor:bigint,key:string,raw:unknown,meta:AuthMeta,restore:boolean){
  key=await parseInput(websiteResourceKeySchema,key);const input=await parseInput(restore?websiteRestoreSchema:websitePublishSchema,raw)
  return auditedWrite(db,{actor,meta,action:restore?'website.restore':'website.publish',id:null,targetType:'site_settings',targetName:key,isolationLevel:'read committed'},async tx=>{
   // Authorize without write locks; unrelated resources never join this lock set.
   const initial=await repo.find(tx,key);if(!initial)throw new ApiError('NOT_FOUND')
   await authorizeWebsite(tx,actor,initial,'publish')
   if(initial.draftVersion!==input.version||initial.stateVersion!==input.stateVersion||(initial.publishedReleaseId?String(initial.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','version')
   await lockSiteConfig(tx)
   if(initial.type==='page')await lockVisiblePageMenu(tx,initial.key.slice(5))
   const source='releaseId' in input?await repo.release(tx,BigInt(String(input.releaseId)),initial.id):undefined
   if(restore&&!source)throw new ApiError('NOT_FOUND')
   const content=source?.content??await resourceSnapshot(tx,initial)
   const keys=[key]
   keys.push(...await publicationLockKeys(tx,initial))
   if(initial.type==='header'||initial.type==='footer'||initial.type==='page'){
    const previous=initial.publishedReleaseId?await repo.release(tx,initial.publishedReleaseId,initial.id):undefined
    // Coordinate both introducing and removing links with their actual target pages.
    keys.push(...[...publishedNavigationLinks(content),...publishedNavigationLinks(previous?.content)].map(link=>`page.${link.target.module}`))
   }
   const locked=await repo.lockKeys(tx,keys),r=locked.find(r=>r.key===key)
   if(!r)throw new ApiError('NOT_FOUND')
   await authorizeWebsite(tx,actor,r,'publish')
   if(r.draftVersion!==input.version||r.stateVersion!==input.stateVersion||(r.publishedReleaseId?String(r.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','version')
   await assertPublicationDependencies(tx,r,content)
   if(r.type!=='page'){siteSettingsSchema.shape[r.type as SiteSection].parse(content);if(r.type==='basic')await assertBasicImagePresentations(tx,siteSettingsSchema.shape.basic.parse(content))}
   else {
    if(!await sitePageEnabled(tx,r.key.slice(5))||!await siteSnapshotEnabled(tx,content))throw new ApiError('INVALID_INPUT',[{path:'content',message:'页面使用了本站未启用的模块。'}])
    await assertPublishedRouteTargets(tx,r.id,content)
    const locales=(await readSiteLanguages(tx)).enabledLocales
    await validateBusinessSectionContent(tx,content,locales)
    const snapshot=await validatePagePublication(r.key.slice(5),content,locales)
    const sections = snapshotSections(content)
    for (const [index, section] of snapshot.sections.entries()) {
      await assertSectionMedia(tx,{fields:publishedFieldDefinition(section.definition),mediaSlots:section.mediaSlots},sections[index]!.shared,section.localized)
    }
   }
   await validatePublishedNavigation(tx,r,content)
   const row=await repo.append(tx,{resourceId:r.id,draftVersion:source?.draftVersion??r.draftVersion,content,restoredFrom:source?.id??null,createdBy:actor})
   await mediaRepository.replaceReferences(tx,`website:release:${row.id}`,snapshotMedia(content));if(!await repo.activate(tx,r.id,row.id))throw conflictError('STALE','stateVersion')
   if(r.type==='page')await taskRepository.requestSearchRebuild(tx)
   return {id:r.id,name:key,changes:auditChanges('site_settings',{}, {settingsVersion:row.draftVersion,settingsSection:key,settingsFields:restore?'恢复本对象历史版本':'发布本对象草稿'}),value:await resourcePublication(tx,{...r,publishedReleaseId:row.id,stateVersion:r.stateVersion+1})}
  })
 }
 return {
  publish:(actor:bigint,key:string,raw:unknown,meta:AuthMeta)=>write(actor,key,raw,meta,false),restore:(actor:bigint,key:string,raw:unknown,meta:AuthMeta)=>write(actor,key,raw,meta,true),
  async detail(actor:bigint,key:string,id:string):Promise<WebsiteReleaseDetail>{return db.transaction(async tx=>{const r=await repo.find(tx,key);if(!r)throw new ApiError('NOT_FOUND');await authorizeWebsite(tx,actor,r,'read');const row=await repo.release(tx,BigInt(id),r.id);if(!row)throw new ApiError('NOT_FOUND');return {...(await releaseMetadata(tx,[row]))[0]!,resourceKey:key,isCurrent:row.id===r.publishedReleaseId,content:row.content}},{isolationLevel:'repeatable read'})},
  async history(actor:bigint,key:string){return db.transaction(async tx=>{const r=await repo.find(tx,key);if(!r)throw new ApiError('NOT_FOUND');await authorizeWebsite(tx,actor,r,'read');return resourcePublication(tx,r)},{isolationLevel:'repeatable read'})},
 }
}

async function validatePublishedNavigation(db:DatabaseExecutor,resource:WebsiteResource,content:unknown){
 const all=await repo.all(db),targets=await websiteNavigationTargets(db)
 if(resource.type==='page'){
  const valid=publishedPageTargets(content)
  for(const r of all.filter(r=>(r.type==='header'||r.type==='footer'||r.type==='page')&&r.publishedReleaseId)){
   const release=await repo.release(db,r.publishedReleaseId!,r.id)
   const supported=new Map<string,boolean>()
   for(const link of publishedNavigationLinks(r.id===resource.id?content:release?.content))supported.set(link.target.type,await supportsBusinessNavigationTarget(db,content,link.target.type))
   if(publishedNavigationLinks(r.id===resource.id?content:release?.content).some(l=>l.target.resourceId===String(resource.id)&&(l.target.type==='anchor'&&!valid.has(l.target.value)||!supported.get(l.target.type))))throw new ApiError('INVALID_INPUT',[{path:'content',message:'已发布内容仍引用将移除的页面位置或新闻分类，请先调整并发布引用内容。'}])
  }
 }
 if(resource.type==='header'||resource.type==='footer'||resource.type==='page'){
  for(const l of publishedNavigationLinks(content)){
   if(!targets.some(t=>sameLinkTarget(l.target,t.target)))throw new ApiError('INVALID_INPUT',[{path:'content',message:'跳转目标已不可用，请重新选择。'}])
   const page=all.find(r=>String(r.id)===l.target.resourceId)
   if(page?.publishedReleaseId&&l.target.type==='anchor'){
    const release=await repo.release(db,page.publishedReleaseId,page.id)
    const valid=publishedPageTargets(release!.content)
    if(!valid.has(l.target.value))throw new ApiError('INVALID_INPUT',[{path:'content',message:'导航目标未在对应页面发布版本中显示。'}])
   }
  }
 }
}
