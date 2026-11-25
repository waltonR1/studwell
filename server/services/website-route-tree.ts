import {publicationMetadata} from './publication-metadata'
// 协调路由和 SEO 草稿、发布及回滚；按指定语言校验发布目标，不发布语言草稿。
import {assertPublishedPolicyDependencies} from './website-publication-guards'
import {assertDisabledModulesUnused} from './site-module-maintenance'
import {readWebsiteModulePolicy,saveWebsiteModulePolicy} from '../repositories/website-module-policy'
import {websiteModulePolicySchema} from '#shared/schemas/website/module-policy'
import {sitePageEnabled,siteSnapshotEnabled} from './site-modules'
import {assertSiteSettingLanguages} from '../policies/site-language-content'
import {validateWebsiteBusinessLanguages} from './website-publication-providers'
import {parseWebsiteRoutePattern,websiteRoutePatternIdentity} from '#shared/utils/website/route-pattern'
import {findDetailProvider} from './website-detail-providers'
import {z} from 'zod'
import type {SiteLanguages} from '#shared/config/site-languages'
import {readSiteLanguages} from './site-languages'
import {validatePublishedPageLanguages} from '../policies/website-pages'
import {siteConfigVersionSchema,websiteSeoUpdateSchema} from '#shared/schemas/admin/website-site-config'
import type {WebsiteSeoEntry,WebsiteSiteConfigSnapshot} from '#shared/types/website/site-config'
import {readSeo,saveSeo,seoIdentity,seoOwner,lockSiteConfig,readSiteConfig,bumpSiteConfig,appendConfigRelease,configReleases,configRelease,replacePublishedSeo} from '../repositories/website-site-config'
import {mediaRepository} from '../repositories/media'
import {publishedNavigationLinks} from '../policies/website-navigation'
import {auditService} from './audit'
import {auditChanges} from '../policies/audit-changes'
import type {AuthMeta} from '../core/auth-context'
import {conflictError} from '../core/errors'
import {detachPublishedRouteNode,readRouteNodes,insertRouteNode,updateRouteNode,deleteRouteNode} from '../repositories/website-route-tree'
import {parseInput} from '../core/validation'
import {readPublishedRoutes,lockRouteNodes,replacePublishedRoutes,type PublishedRouteInsert} from '../repositories/website-route-tree'
import type {Database,DatabaseExecutor} from '../db/transaction'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {projectWebsiteRouteTree} from '#shared/utils/website/route-tree'
import {ApiError} from '../core/errors'
import {taskRepository} from '../repositories/tasks'
import {requirePermission} from './access/permissions'
const invalid=(message:string)=>new ApiError('INVALID_INPUT',[{path:'routes',message}])
async function audit(db:DatabaseExecutor,actor:bigint,meta:AuthMeta,action:string,version:number){
 await auditService.write(db,{...meta,actorId:actor,action,targetType:'site_settings',targetId:'1',targetName:'路由与 SEO',result:'success',createdAt:new Date(),changeContext:auditChanges('site_settings',{}, {settingsVersion:version,settingsSection:'路由与 SEO',settingsFields:action})})
}
async function assertSeoMedia(db:DatabaseExecutor,entries:WebsiteSeoEntry[]){
 for(const id of [...new Set(entries.flatMap(row=>row.ogMediaId?[row.ogMediaId]:[]))].sort()){
  const asset=await mediaRepository.find(db,BigInt(id),true)
  if(!asset||asset.kind!=='image')throw invalid('OG 图片不可用。')
 }
}
export async function validateSiteConfig(db:DatabaseExecutor,snapshot:WebsiteSiteConfigSnapshot,languages:SiteLanguages){
 const locales=languages.enabledLocales
 const currentLanguages=await readSiteLanguages(db)
 const addedLocales=locales.filter(locale=>!currentLanguages.enabledLocales.includes(locale))
 const pages=await resources.lockKeys(db,(await resources.all(db)).filter(row=>row.type==='page').map(row=>row.key))
 const paths=new Set<string>(),targets=new Set<string>()
 const routedSnapshots:unknown[]=[]
 for(const node of snapshot.routes){
  const page=pages.find(row=>String(row.id)===node.resourceId)
  if(!page)throw invalid('路由目标不存在：'+node.path)
  const identity=seoIdentity(node)
  const pattern=websiteRoutePatternIdentity(node.path)
  if(!pattern)throw invalid('无效或保留的路由：'+node.path)
  if(paths.has(pattern)||targets.has(identity))throw invalid('路径或目标重复。')
  paths.add(pattern);targets.add(identity)
  if(node.enabled===false)continue
  if(!page.publishedReleaseId)throw invalid('路由目标尚未发布：'+node.path)
  const release=await resources.release(db,page.publishedReleaseId,page.id)
  if(!release)throw invalid('路由目标尚未发布：'+node.path)
  if(!await sitePageEnabled(db,page.key.slice(5))||!await siteSnapshotEnabled(db,release.content))throw invalid('路由目标使用了本站未启用的模块：'+node.path)
  routedSnapshots.push(release.content)
  const parameter=parseWebsiteRoutePattern(node.path)?.parameter
  if(parameter&&!await findDetailProvider(db,parameter,release.content))throw invalid('动态路由缺少已发布的详情区块：'+node.path)
  await validatePublishedPageLanguages(release.content,locales)
  if(parameter)continue
  const seo=snapshot.seo.filter(row=>seoIdentity(row)===identity)
  if(locales.some(locale=>!seo.some(row=>row.locale===locale&&row.title.trim()&&row.description.trim())))throw invalid('请补齐路由目标启用语言的 SEO 标题和描述：'+node.path)
 }
 for(const parent of (await resources.all(db)).filter(row=>(row.type==='header'||row.type==='footer'||row.type==='page')&&row.publishedReleaseId)){
  const release=await resources.release(db,parent.publishedReleaseId!,parent.id)
  if(parent.type==='header'||parent.type==='footer')assertSiteSettingLanguages(release?.content,addedLocales,parent.type)
  for(const link of publishedNavigationLinks(release?.content)){
   const page=pages.find(row=>String(row.id)===link.target.resourceId)
   if(!snapshot.routes.some(row=>row.enabled!==false&&row.resourceId===String(page?.id)&&!parseWebsiteRoutePattern(row.path)?.parameter))throw invalid('已发布内容引用即将失效的目标，请先调整并发布引用内容。')
  }
 }
 await validateWebsiteBusinessLanguages(db,routedSnapshots,locales)
 await assertSeoMedia(db,snapshot.seo)
}
export async function publishWebsiteRouteTree(db:Database,actor:bigint,raw:unknown,meta:AuthMeta){
 const input=await parseInput(siteConfigVersionSchema,raw)
 return db.transaction(async tx=>{
  if(!(await requirePermission(tx,actor,'content.routes.publish')).isRoot)throw new ApiError('FORBIDDEN')
  const state=await lockSiteConfig(tx)
  if(input.version!==state.version||input.publishedReleaseId!==(state.publishedReleaseId===null?null:String(state.publishedReleaseId)))throw conflictError('STALE','version')
  const rows=await lockRouteNodes(tx)
  const source=input.releaseId?await configRelease(tx,BigInt(input.releaseId)):undefined
  if(input.releaseId&&!source)throw new ApiError('NOT_FOUND')
  const draft=source?null:project(rows)
  const routes=source?source.content.routes:draft!.filter(row=>row.targetType!=='group').map(row=>({path:row.path,routeNodeId:row.id,resourceId:row.resourceId!,enabled:row.enabled}))
  const targets=new Set(routes.filter(route=>!parseWebsiteRoutePattern(route.path)?.parameter).map(seoIdentity))
  const snapshot:WebsiteSiteConfigSnapshot={routes,seo:(source?source.content.seo:await readSeo(tx,true)).filter(row=>targets.has(seoIdentity(row)))}
  // Rollback paths go through the same reserved-path/depth rules as new drafts.
  await validateSiteConfig(tx,snapshot,await readSiteLanguages(tx))
  const release=await appendConfigRelease(tx,actor,state.version,snapshot,source?.id??null)
  await mediaRepository.replaceReferences(tx,`website:config:${release.id}`,snapshot.seo.flatMap((row,i)=>row.ogMediaId?[{mediaId:BigInt(row.ogMediaId),field:`seo.${i}.ogMediaId`}]:[]))
  const index:PublishedRouteInsert[]=snapshot.routes.filter(row=>row.enabled!==false).map(row=>({path:row.path,resourceId:BigInt(row.resourceId),routeNodeId:row.routeNodeId&&rows.some(node=>String(node.id)===row.routeNodeId)?BigInt(row.routeNodeId):null}))
  await replacePublishedRoutes(tx,index);await replacePublishedSeo(tx,snapshot.seo)
  if(!await bumpSiteConfig(tx,state.version,release.id))throw conflictError('STALE','version')
  await audit(tx,actor,meta,source?'website.config.restore':'website.config.publish',state.version)
  await taskRepository.requestSearchRebuild(tx)
  return {published:index.length,publishedReleaseId:String(release.id),version:state.version+1}
 },{isolationLevel:'read committed'})
}

export async function assertPublishedRouteTargets(db:DatabaseExecutor,resourceId:bigint,content:unknown){
 const route=(await readPublishedRoutes(db)).find(row=>row.resourceId===resourceId)
 if(!route)return
 if(!content)throw invalid('请先停用路由 '+route.path+' 并发布路由与 SEO。')
 const parameter=parseWebsiteRoutePattern(route.path)?.parameter
 if(parameter&&!await findDetailProvider(db,parameter,content))throw invalid('请保留动态路由所需的详情区块：'+route.path)
}

const id=z.string().regex(/^[1-9][0-9]{0,19}$/)
export const routeNodeMutationSchema=z.discriminatedUnion('action',[
 z.strictObject({version:z.number().int().positive(),action:z.literal('set-enabled'),id,enabled:z.boolean()}),
 z.strictObject({version:z.number().int().positive(),action:z.literal('save'),id:id.nullable(),parentId:id.nullable(),slug:z.string().max(64),targetType:z.enum(['group','page']),resourceId:id.nullable()}),
 z.strictObject({version:z.number().int().positive(),action:z.literal('module-policy'),policy:websiteModulePolicySchema}),
 z.strictObject({version:z.number().int().positive(),action:z.literal('delete'),id}),websiteSeoUpdateSchema,
])
async function root(db:DatabaseExecutor,actor:bigint,operation:'read'|'update'){
 if(!(await requirePermission(db,actor,'content.routes.'+operation)).isRoot)throw new ApiError('FORBIDDEN')
}
function project(rows:Awaited<ReturnType<typeof readRouteNodes>>){
 try{return projectWebsiteRouteTree(rows.map(row=>({...row,id:String(row.id),parentId:row.parentId===null?null:String(row.parentId),resourceId:row.resourceId===null?null:String(row.resourceId)})))}
 catch(error){throw invalid(error instanceof Error?error.message:'Invalid route tree')}
}
export async function readWebsiteRouteTree(db:Database,actor:bigint){
 return db.transaction(async tx=>{
  await root(tx,actor,'read')
  const draft=project(await readRouteNodes(tx))
  const online=(await readPublishedRoutes(tx)).map(row=>({...row,resourceId:String(row.resourceId),routeNodeId:row.routeNodeId===null?null:String(row.routeNodeId)}))
  const pages=(await resources.all(tx)).filter(page=>page.type==='page').map(page=>({id:String(page.id),key:page.key.slice(5),published:!!page.publishedReleaseId}))
  const state=await readSiteConfig(tx)
  return {modulePolicy:await readWebsiteModulePolicy(tx),draft,online,pages,version:state.version,publishedReleaseId:state.publishedReleaseId===null?null:String(state.publishedReleaseId),seo:await readSeo(tx,true),publishedSeo:await readSeo(tx),releases:await publicationMetadata(tx,await configReleases(tx))}
 },{isolationLevel:'repeatable read'})
}

export async function mutateWebsiteRouteNode(db:Database,actor:bigint,raw:unknown,meta:AuthMeta){
 const input=await parseInput(routeNodeMutationSchema,raw)
 await db.transaction(async tx=>{
  await root(tx,actor,'update')
  const state=await lockSiteConfig(tx)
  if(state.version!==input.version)throw conflictError('STALE','version')
  const rows=await lockRouteNodes(tx)
  if(input.action==='module-policy'){
   await assertDisabledModulesUnused(tx,input.policy)
   await assertPublishedPolicyDependencies(tx,input.policy)
   const current=await readWebsiteModulePolicy(tx)
   await saveWebsiteModulePolicy(tx,input.policy,current.version)
   await bumpSiteConfig(tx,state.version);await audit(tx,actor,meta,'website.config.save',state.version)
   await taskRepository.requestSearchRebuild(tx);return
  }
  if(input.action==='seo'){
   if(new Set(input.entries.map(row=>row.locale)).size!==input.entries.length)throw invalid('语言不能重复。')
   const resource=(await resources.all(tx)).find(row=>String(row.id)===input.resourceId&&row.type==='page')
   if(!resource)throw new ApiError('NOT_FOUND')
   if(project(rows).some(row=>row.resourceId===input.resourceId&&parseWebsiteRoutePattern(row.path)?.parameter))throw invalid('动态详情的 SEO 由业务内容维护。')
   const entries=input.entries.map(row=>({...row,resourceId:input.resourceId}))
   await assertSeoMedia(tx,entries);await saveSeo(tx,entries)
   const allEntries=(await readSeo(tx,true)).filter(row=>row.resourceId===input.resourceId)
   await mediaRepository.replaceReferences(tx,seoOwner(entries[0]!),allEntries.flatMap(row=>row.ogMediaId?[{mediaId:BigInt(row.ogMediaId),field:row.locale+'.ogMediaId'}]:[]))
   await bumpSiteConfig(tx,state.version);await audit(tx,actor,meta,'website.config.save',state.version);return
  }
  const existing=input.id?rows.find(row=>String(row.id)===input.id):undefined
  if(input.id&&!existing)throw new ApiError('NOT_FOUND')
  if(input.action==='set-enabled'){
   if(existing!.targetType!=='page')throw invalid('分组节点不支持启停，请操作具体页面路由。')
   await updateRouteNode(tx,existing!.id,{enabled:input.enabled})
   await bumpSiteConfig(tx,state.version);await audit(tx,actor,meta,'website.config.save',state.version)
   return
  }
  if(input.action==='delete'){
   if(rows.some(row=>row.parentId===existing!.id))throw invalid('请先移动或删除子节点。')
   if((await readPublishedRoutes(tx)).some(row=>row.routeNodeId===existing!.id)){
    await detachPublishedRouteNode(tx,existing!.id)
   }
   await deleteRouteNode(tx,existing!.id)
   await bumpSiteConfig(tx,state.version);await audit(tx,actor,meta,'website.config.save',state.version)
   return
  }
  const {slug,targetType}=input
  const parentId=input.parentId?BigInt(input.parentId):null
  const resourceId=input.resourceId?BigInt(input.resourceId):null
  const value={slug,targetType,parentId,resourceId}
  if(resourceId!==null&&!(await resources.all(tx)).some(row=>row.id===resourceId&&row.type==='page'))throw invalid('目标页面不存在。')
  project([...rows.filter(row=>row.id!==existing?.id),{...value,id:existing?.id??0n,enabled:existing?.enabled??true,sortOrder:existing?.sortOrder??0}])
  if(existing)await updateRouteNode(tx,existing.id,value)
  else await insertRouteNode(tx,value)
  await bumpSiteConfig(tx,state.version);await audit(tx,actor,meta,'website.config.save',state.version)
 },{isolationLevel:'read committed'})
 return readWebsiteRouteTree(db,actor)
}
