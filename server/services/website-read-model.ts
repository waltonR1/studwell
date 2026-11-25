// 读取官网资源快照及发布元数据，供管理与发布业务组合。
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {isDeepStrictEqual} from 'node:util'
import type {DatabaseExecutor} from '../db/transaction'
import {websiteResourceRepository as repo} from '../repositories/website-resources'
import {readSiteNavigation} from '../repositories/site-settings'

import {siteSettingsSchema} from '#shared/schemas/admin/site-settings'
import {normalizeSectionPlacement} from '#shared/utils/website/page-layouts'
import type {WebsitePublication} from '#shared/types/admin/website'
import {ApiError} from '../core/errors'
import {publicationMetadata} from './publication-metadata'
export async function releaseMetadata(db:DatabaseExecutor,rows:NonNullable<Awaited<ReturnType<typeof repo.release>>>[]){
 const metadata=await publicationMetadata(db,rows)
 return metadata.map((row,index)=>({...row,draftVersion:rows[index]!.draftVersion}))
}
export type WebsiteResource=NonNullable<Awaited<ReturnType<typeof repo.find>>>
export async function resourceSnapshot(db:DatabaseExecutor,r:WebsiteResource):Promise<unknown>{
 const draft=await repo.draft(db,r.id);if(!draft)throw new ApiError('NOT_FOUND')
 if(r.type==='page'){
  const all=await repo.sections(db,r.id)
  const snapshot=({section,template,revision}:typeof all[number])=>({id:String(section.id),templateKey:template.key,renderer:revision.definition.publicRendererId,videoPath:revision.definition.banner?.videoPath??null,name:revision.definition.name,allowedPages:revision.definition.allowedPages,sortOrder:section.sortOrder,visible:section.visible,anchorKey:section.anchorKey,shared:section.sharedContent,localized:section.localizedContent,definition:revision.definition.fields,mediaSlots:revision.definition.mediaSlots})
  const settings=websitePageSettingsSchema.parse(draft.content),sections=all.map(snapshot)
  return {settings,sections:normalizeSectionPlacement(sections)}
 }
 return siteSettingsSchema.shape[r.type].parse({...draft.content as object,...(r.type==='basic'?{}:await readSiteNavigation(db,r.id,r.type))})
}
export async function resourcePublication(db:DatabaseExecutor,r:WebsiteResource):Promise<WebsitePublication>{
 const history=await repo.listReleases(db,r.id),current=history.find(x=>x.id===r.publishedReleaseId)
 const draft=current?await resourceSnapshot(db,r):null
 const comparable=(content:unknown)=>{
  if(r.type!=='page')return content
  const page=content as {settings:unknown;sections:Array<Record<string,unknown>>}
  // Media slot metadata describes historical display, not a content change.
  return {...page,settings:websitePageSettingsSchema.parse(page.settings),sections:page.sections.map(({mediaSlots,...section})=>section)}
 }
 return {stateVersion:r.stateVersion,status:r.publishedReleaseId?'published':history.length?'offline':'unpublished',changed:!current||!isDeepStrictEqual(comparable(draft),comparable(current.content)),draftVersion:r.draftVersion,publishedReleaseId:r.publishedReleaseId?String(r.publishedReleaseId):null,publishedDraftVersion:current?.draftVersion??null,releases:await releaseMetadata(db,history)}
}
