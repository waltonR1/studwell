// 将草稿、当前发布或指定历史快照投影为后台整页预览，不改变发布状态。
import {businessLinkLocations} from './website-navigation-providers'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {readSiteLanguages,readPublishedSiteContext} from './site-languages'
import {z} from 'zod'
import {readPublishedRoutes} from '../repositories/website-route-tree'
import {websitePreviewData} from './website-preview-providers'
import {entityIdSchema} from '#shared/schemas/entity'
import {readSeo} from '../repositories/website-site-config'
import {resolveSeo} from './public-website-seo'
import {readRouteNodes} from '../repositories/website-route-tree'
import {projectWebsiteRouteTree} from '#shared/utils/website/route-tree'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {PublicLocale} from '#shared/schemas/public/queries'
import type {WebsiteResource} from './website-read-model'
import type {WebsitePagePreviewView} from '#shared/types/admin/website-preview'
import {projectPublicSiteSettings} from './public-site-settings'
import {publicLocalizedQuerySchema} from '#shared/schemas/public/queries'
import {authorizeWebsite} from './website-access'
import {resourceSnapshot} from './website-read-model'
import {websiteResourceRepository as repo} from '../repositories/website-resources'
import {publishedPageSnapshotSchema} from '../policies/public-website-snapshot'
import {projectWebsiteSnapshot} from './public-website-page'
import {parseInput} from '../core/validation'
import {ApiError} from '../core/errors'

export async function previewWebsitePage(db:Database,actor:bigint,key:string,query:unknown):Promise<WebsitePagePreviewView>{
 const {locale,mode,sectionId,releaseId}=await parseInput(publicLocalizedQuerySchema.extend({mode:z.enum(['draft','published','history']).default('draft'),sectionId:entityIdSchema.optional(),releaseId:entityIdSchema.optional()}).refine(value=>value.mode==='history'?!!value.releaseId&&!value.sectionId:value.releaseId===undefined,{path:['releaseId'],message:'历史整页预览必须指定发布版本，其他预览不能指定历史版本。'}),query)
 return db.transaction(async tx=>{
  const r=await repo.find(tx,'page.'+key)
  if(!r||r.type!=='page')throw new ApiError('NOT_FOUND')
  await authorizeWebsite(tx,actor,r,'read')
  return projectWebsitePagePreview(tx,r,locale??(await readSiteLanguages(tx,true)).defaultLocale,mode,sectionId,releaseId)
 },{isolationLevel:'repeatable read'})
}

export async function projectWebsitePagePreview(tx:DatabaseExecutor,r:WebsiteResource,locale:PublicLocale,mode:'draft'|'published'|'history',sectionId?:string,historyReleaseId?:string):Promise<WebsitePagePreviewView>{
  const key=r.key.slice(5)
  const draft=mode==='draft'
  const seoRows=await readSeo(tx,draft)
  const nodes=draft?await readRouteNodes(tx):[]
  const routes=projectWebsiteRouteTree(nodes.map(node=>({...node,id:String(node.id),parentId:node.parentId===null?null:String(node.parentId),resourceId:node.resourceId===null?null:String(node.resourceId)})))
  const path=(draft?routes.find(route=>route.resourceId===String(r.id)):(await readPublishedRoutes(tx)).find(route=>route.resourceId===r.id))?.path??''
  const selectedReleaseId=mode==='history'&&historyReleaseId?BigInt(historyReleaseId):r.publishedReleaseId
  const release=!draft&&selectedReleaseId?await repo.release(tx,selectedReleaseId,r.id):undefined
  if(!draft&&!release)throw new ApiError('NOT_FOUND')
  const snapshot=publishedPageSnapshotSchema.parse(draft?await resourceSnapshot(tx,r):release?.content)
  if(sectionId){
   const section=snapshot.sections.find(section=>section.id===sectionId)
   if(!section)throw new ApiError('NOT_FOUND')
   snapshot.sections=[{...section,visible:true}]
   snapshot.settings={...snapshot.settings,sceneEnabled:false}
  }
  if(!draft&&snapshot.sections.some(section=>section.visible&&section.localized[locale]===undefined))throw new ApiError('NOT_FOUND')
  const {settings}=snapshot
  const releaseId=String(release?.id??r.id)
  const context=await readPublishedSiteContext(tx)
  const page=await projectWebsiteSnapshot(tx,key,locale,releaseId,snapshot,draft,context)
  const ids=new Set(page.sections.map(s=>s.id))
  const previewData=await websitePreviewData(tx,snapshot.sections.filter(section=>ids.has(section.id)).map(section=>section.templateKey))
  const previewSettings=await projectPublicSiteSettings(tx,locale,mode!=='history',context)
  const {policy}=await readWebsiteModulePolicy(tx)
  return {page,previewData,previewSettings,structure:{
   linkLocations:businessLinkLocations(policy,snapshot),
   key,resourceId:String(r.id),displayName:settings.displayName[locale]??'',releaseId,path,sceneEnabled:settings.sceneEnabled,sceneTransitionSeconds:settings.sceneTransitionSeconds,seo:await resolveSeo(tx,seoRows,String(r.id),locale),
   sections:snapshot.sections.filter(s=>ids.has(s.id)).map(({id,templateKey,sortOrder,anchorKey})=>({id,templateKey,sortOrder,anchorKey,capabilities:policy.templates[templateKey]?.provides??[]})),
  }}
}
