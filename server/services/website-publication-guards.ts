// 协调发布与撤回的锁顺序及跨资源依赖校验。
import {businessLinkLocations} from './website-navigation-providers'
import {publishedNavigationLinks} from '../policies/website-navigation'
import {modulePolicyChecks} from '../policies/site-modules'
// 发布依赖来自数据库能力规则，检查所有页面，不按页面或模板名称分支。
import type {DatabaseExecutor} from '../db/transaction'
import type {WebsiteResource} from './website-read-model'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {conflictError} from '../core/errors'
import type {WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
function capabilities(policy:WebsiteModulePolicy,content:unknown){
 const sections=(content as {sections?:Array<{visible:boolean;templateKey:string}>})?.sections??[]
 const rules=sections.filter(section=>section.visible).flatMap(section=>policy.templates[section.templateKey]?[policy.templates[section.templateKey]!]:[])
 return {provides:rules.flatMap(rule=>rule.provides),requires:rules.flatMap(rule=>rule.requires)}
}
async function checkDependencies(db:DatabaseExecutor,policy:WebsiteModulePolicy,resource?:WebsiteResource,next?:unknown){
 const checks=modulePolicyChecks(policy)
 const contents=[]
 for(const page of await resources.all(db)){
  if(page.type!=='page'||!checks.page(page.key.slice(5)))continue
  const content=page.id===resource?.id?next:page.publishedReleaseId?(await resources.release(db,page.publishedReleaseId,page.id))?.content:null
  if(content&&checks.snapshot(content))contents.push(content)
 }
 const effective=contents.map(content=>capabilities(policy,content))
 const provided=new Set(effective.flatMap(value=>value.provides))
 if(effective.some(value=>value.requires.some(name=>!provided.has(name))))throw conflictError('DEPENDENCY_UNAVAILABLE','sections')
}
export async function publicationLockKeys(db:DatabaseExecutor,resource:WebsiteResource){
 return resource.type==='page'?(await resources.all(db)).filter(page=>page.type==='page').map(page=>page.key):[]
}
export async function assertPublicationDependencies(db:DatabaseExecutor,resource:WebsiteResource,content:unknown){if(resource.type==='page')await checkDependencies(db,(await readWebsiteModulePolicy(db)).policy,resource,content)}
export async function assertWithdrawalDependencies(db:DatabaseExecutor,resource:WebsiteResource){await checkDependencies(db,(await readWebsiteModulePolicy(db)).policy,resource,null)}

export async function assertPublishedPolicyDependencies(db:DatabaseExecutor,policy:WebsiteModulePolicy){
 await checkDependencies(db,policy)
 const checks=modulePolicyChecks(policy),pages=new Map<string,unknown>(),contents=[]
 for(const resource of await resources.all(db))if(resource.publishedReleaseId){
  const content=(await resources.release(db,resource.publishedReleaseId,resource.id))?.content
  if(resource.type==='page'){
   if(!checks.page(resource.key.slice(5))||!checks.snapshot(content))continue
   pages.set(String(resource.id),content)
  }
  contents.push(content)
 }
 for(const content of contents)for(const {target} of publishedNavigationLinks(content)){
  if(target.type==='page'||target.type==='anchor')continue
  const destination=pages.get(target.resourceId)
  if(destination&&!businessLinkLocations(policy,destination)[target.type])throw conflictError('REFERENCED','policy')
 }
}
