// 查询已发布页面的区块能力和导航引用关系。
import {modulePolicyChecks} from '../policies/site-modules'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import type {DatabaseExecutor} from '../db/transaction'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {publishedNavigationLinks} from '../policies/website-navigation'

type PageSnapshot = {
 sections?: Array<{templateKey:string;visible:boolean;}>
}

export function hasPublishedSection(content:unknown,templateKey:string){
 const snapshot=content as PageSnapshot|null|undefined
 return snapshot?.sections?.some(section=>section.templateKey===templateKey&&section.visible)??false
}

export async function pagesPublishingSection(db:DatabaseExecutor,templateKey:string){
 const pages=[]
 for(const resource of await resources.all(db)){
  if(resource.type!=='page'||!resource.publishedReleaseId)continue
  const release=await resources.release(db,resource.publishedReleaseId,resource.id)
  if(hasPublishedSection(release?.content,templateKey))pages.push(resource)
 }
 return pages
}

// 业务提供者由数据库能力规则识别，模板可以使用任意代称。
export async function pagesProvidingCapability(db:DatabaseExecutor,capability:string){
 const {policy}=await readWebsiteModulePolicy(db)
 const checks=modulePolicyChecks(policy)
 const keys=Object.entries(policy.templates).filter(([,rule])=>rule.provides.includes(capability)).map(([key])=>key)
 const result=new Map<bigint,Awaited<ReturnType<typeof resources.all>>[number]>()
 for(const key of keys)for(const page of await pagesPublishingSection(db,key)){
  if(!checks.page(page.key.slice(5)))continue
  const release=await resources.release(db,page.publishedReleaseId!,page.id)
  if(checks.snapshot(release?.content))result.set(page.id,page)
 }
 return [...result.values()]
}
export const publishedNewsPages = (db:DatabaseExecutor) => pagesProvidingCapability(db,'news.list')

// Reads within the caller's transaction; authorization and lock order belong to the operation.
export async function publishedPageReferences(db:DatabaseExecutor,key:string){
 const references:Array<'header'|'footer'|'page'>=[]
 for(const parent of await resources.all(db)){
  if(!['header','footer','page'].includes(parent.type)||!parent.publishedReleaseId||parent.key==='page.'+key)continue
  const release=await resources.release(db,parent.publishedReleaseId,parent.id)
  if(publishedNavigationLinks(release?.content).some(link=>link.target.module===key))references.push(parent.type as 'header'|'footer'|'page')
 }
 return references
}
