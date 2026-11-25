// 清理历史发布：与发布共用锁，保护当前版本，引用和审计随快照同事务提交。
import {publicationHistoryCleanupSchema} from '#shared/schemas/admin/publication-history'
import type {Database} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {newsRepository as news} from '../repositories/news'
import {publicationHistoryRepository as history} from '../repositories/publication-history'
import {mediaRepository} from '../repositories/media'
import {lockSiteConfig,configRelease,bumpSiteConfig} from '../repositories/website-site-config'
import {lockLanguageConfig,languageRelease,saveLanguageConfig} from '../repositories/site-languages'
import {authorizeWebsite} from './website-access'
import {lockVisiblePageMenu} from './website-menu-lifecycle'
import {requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'

export async function cleanupPublicationHistory(db:Database,actor:bigint,raw:unknown,meta:AuthMeta){
 const input=await parseInput(publicationHistoryCleanupSchema,raw),releaseId=BigInt(input.releaseId)
 return auditedWrite(db,{actor,meta,action:'publication.history.delete',id:releaseId,targetType:'site_settings',isolationLevel:'read committed'},async tx=>{
  const config=await lockSiteConfig(tx)
  let owner:string|undefined,name:string
  const assertHistorical=(current:bigint|null)=>{
   if((current===null?null:String(current))!==input.publishedReleaseId)throw conflictError('STALE','version')
   if(current===releaseId)throw new ApiError('INVALID_INPUT',[{path:'releaseId',message:'当前发布版本不能清理，请先发布其他版本或下线。'}])
  }
  if(input.kind==='website'){
   const initial=await resources.find(tx,input.key)
   if(!initial)throw new ApiError('NOT_FOUND')
   await authorizeWebsite(tx,actor,initial,'publish')
   if(initial.type==='page')await lockVisiblePageMenu(tx,initial.key.slice(5))
   const resource=(await resources.lockKeys(tx,[input.key]))[0]
   if(!resource)throw new ApiError('NOT_FOUND')
   await authorizeWebsite(tx,actor,resource,'publish')
   if(resource.draftVersion!==input.version||resource.stateVersion!==input.stateVersion)throw conflictError('STALE','version')
   assertHistorical(resource.publishedReleaseId)
   if(!await resources.release(tx,releaseId,resource.id))throw new ApiError('NOT_FOUND')
   if(!await history.website(tx,resource.id,releaseId))throw conflictError('STALE','version')
   owner=`website:release:${releaseId}`;name=input.key
  }else if(input.kind==='news'){
   await requirePermission(tx,actor,'content.news.publish')
   const article=await news.article(tx,BigInt(input.articleId),true)
   if(!article)throw new ApiError('NOT_FOUND')
   if(article.draftVersion!==input.version||article.stateVersion!==input.stateVersion)throw conflictError('STALE','version')
   assertHistorical(article.publishedReleaseId)
   if(!await news.release(tx,releaseId,article.id))throw new ApiError('NOT_FOUND')
   if(!await history.news(tx,article.id,releaseId))throw conflictError('STALE','version')
   owner=`news:release:${releaseId}`;name=article.slug
  }else{
   const access=await requirePermission(tx,actor,input.kind==='languages'?'content.site_languages.publish':'content.routes.publish')
   if(!access.isRoot)throw new ApiError('FORBIDDEN')
   const state=input.kind==='languages'?await lockLanguageConfig(tx):config
   if(state.version!==input.version)throw conflictError('STALE','version')
   assertHistorical(state.publishedReleaseId)
   const release=input.kind==='languages'?await languageRelease(tx,releaseId):await configRelease(tx,releaseId)
   if(!release)throw new ApiError('NOT_FOUND')
   if(input.kind==='languages'){
    await history.languages(tx,releaseId)
    if(!await saveLanguageConfig(tx,state.version,{}))throw conflictError('STALE','version')
    name='站点语言'
   }else{
    await history.routes(tx,releaseId)
    if(!await bumpSiteConfig(tx,state.version))throw conflictError('STALE','version')
    owner=`website:config:${releaseId}`;name='路由与 SEO'
   }
  }
  if(owner)await mediaRepository.removeReferencesForOwners(tx,[owner])
  return {id:releaseId,name,changes:auditChanges('site_settings',{settingsSection:name,settingsFields:`历史发布 ${releaseId}`},null),value:{deleted:true as const}}
 })
}
