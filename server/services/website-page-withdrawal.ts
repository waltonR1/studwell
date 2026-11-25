// 协调页面撤回及其引用约束，不删除历史发布内容。
import {lockSiteConfig} from '../repositories/website-site-config'
import {assertPublishedRouteTargets} from './website-route-tree'
import {taskRepository} from '../repositories/tasks'
import type {Database} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {websiteWithdrawSchema} from '#shared/schemas/admin/website'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {authorizeWebsite} from './website-access'
import {resourcePublication} from './website-read-model'
import {publishedPageReferences} from './website-navigation-references'
import {publicationLockKeys,assertWithdrawalDependencies} from './website-publication-guards'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'

export function createWebsitePageWithdrawalService(db:Database){return {
 async withdraw(actor:bigint,key:string,raw:unknown,meta:AuthMeta){
  const input=await parseInput(websiteWithdrawSchema,raw)
  return auditedWrite(db,{actor,meta,action:'website.withdraw',id:null,targetType:'site_settings',targetName:key,isolationLevel:'read committed'},async tx=>{
   await lockSiteConfig(tx)
   const initial=await resources.find(tx,key)
   if(!initial)throw new ApiError('NOT_FOUND')
   if(initial.type!=='page')throw new ApiError('INVALID_INPUT',[{path:'key',message:'仅网页支持下线。'}])
   await authorizeWebsite(tx,actor,initial,'publish')
   const dependencyKeys=await publicationLockKeys(tx,initial)
   const resource=(await resources.lockKeys(tx,[key,...dependencyKeys])).find(page=>page.key===key)
   if(!resource)throw new ApiError('NOT_FOUND')
   await authorizeWebsite(tx,actor,resource,'publish')
   if(resource.stateVersion!==input.stateVersion||resource.draftVersion!==input.version||(resource.publishedReleaseId?String(resource.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','stateVersion')
   if(!resource.publishedReleaseId)throw new ApiError('INVALID_INPUT',[{path:'state',message:'页面没有当前发布版本，无需下线。'}])
   await assertWithdrawalDependencies(tx,resource)
   const references=(await publishedPageReferences(tx,resource.key.slice(5))).map(type=>({path:'navigation',message:`${type==='header'?'页头':type==='footer'?'页脚':'其他页面'}仍有指向此页面的已发布链接，请先调整并发布引用内容。`}))
   if(references.length)throw new ApiError('CONFLICT',references,undefined,'PAGE_LINKED')
   await assertPublishedRouteTargets(tx,resource.id,undefined)
   if(!await resources.withdraw(tx,resource.id,input.stateVersion))throw conflictError('STALE','stateVersion')
   await taskRepository.requestSearchRebuild(tx)
   return {id:resource.id,name:key,changes:auditChanges('site_settings',{}, {settingsFields:'下线页面'}),value:await resourcePublication(tx,{...resource,publishedReleaseId:null,stateVersion:resource.stateVersion+1})}
  })
 },
}}
