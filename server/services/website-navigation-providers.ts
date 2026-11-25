// 业务适配器声明能力、查询参数和数据来源，通用链接只消费投影后的定位信息。
import type {DatabaseExecutor} from '../db/transaction'
import type {SiteTarget} from '#shared/types/admin/site-settings'
import type {WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
import {newsRepository} from '../repositories/news'
import {sitePagePath} from '#shared/utils/website/site-link'
import {capabilitySections,snapshotHasCapability} from './website-capabilities'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
const providers=[{type:'news-category',capability:'news.list',queryKey:'category',async entries(db:DatabaseExecutor){return (await newsRepository.categories(db)).filter(category=>category.enabled).map(category=>({value:category.code,label:category.name}))}}]
export function businessLinkLocations(policy:WebsiteModulePolicy,content:unknown){
 const sections=capabilitySections(policy,content),result:Record<string,{queryKey:string;anchorKey:string|null}>={}
 for(const provider of providers){const section=sections.find(section=>section.capabilities.includes(provider.capability));if(section)result[provider.type]={queryKey:provider.queryKey,anchorKey:section.anchorKey??null}}
 return result
}
export async function websiteBusinessNavigationEntries(db:DatabaseExecutor,content:unknown,page:{module:string;resourceId:string;path:string}){
 const locations=businessLinkLocations((await readWebsiteModulePolicy(db)).policy,content)
 const entries:Array<Pick<SiteTarget,'label'|'path'>&{type:string;value:string}>=[]
 for(const provider of providers)if(locations[provider.type])for(const entry of await provider.entries(db))entries.push({...entry,type:provider.type,path:sitePagePath({type:provider.type,module:page.module,resourceId:page.resourceId,value:entry.value},{path:page.path,linkLocations:locations})})
 return entries
}
export async function supportsBusinessNavigationTarget(db:DatabaseExecutor,content:unknown,type:string){
 if(type==='page'||type==='anchor')return true
 const provider=providers.find(provider=>provider.type===type)
 return !!provider&&await snapshotHasCapability(db,content,provider.capability)
}

// 公开页面和已保存样例都在读取时根据当前数据库策略投影能力，存储结构不承担运行期映射。
export function projectPageCapabilities<T extends {sections:Array<{templateKey:string;anchorKey?:string}>}>(policy:WebsiteModulePolicy,page:T){
 const content={sections:page.sections.map(section=>({...section,visible:true}))}
 return {...page,linkLocations:businessLinkLocations(policy,content),sections:page.sections.map(section=>({...section,capabilities:policy.templates[section.templateKey]?.provides??[]}))}
}
