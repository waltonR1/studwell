// 读取可用模板目录及修订合同，不使用本地模板字段预设。
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {siteModuleCatalog,type SiteModuleName} from '#shared/config/site-modules'
import type {WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
import type {DatabaseExecutor} from '../db/transaction'
import {websiteTemplateRepository as repo} from '../repositories/website-templates'
import {menuRepository} from '../repositories/menus'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import type {WebsiteTemplateCatalogRecord} from '#shared/types/admin/website'
import type {WebsiteTemplateRecord,WebsiteBusinessModule} from '#shared/types/admin/website'

export function templateBusinessModules(policy:WebsiteModulePolicy,key:string):WebsiteBusinessModule[]{
 const rule=policy.templates[key]
 if(!rule)return []
 // UI 标记仅描述使用业务 API 的能力，不把普通展示模板的模块依赖当作 API。
 const apiCapabilities:Record<SiteModuleName,readonly string[]>={news:['news.list','news.article'],careers:['careers.positions'],inquiries:['inquiries.form']}
 const capabilities=new Set([...rule.provides,...rule.requires])
 return [...new Set(rule.modules)].filter(module=>apiCapabilities[module].some(capability=>capabilities.has(capability))).map(module=>({key:module,name:siteModuleCatalog[module].name,path:siteModuleCatalog[module].path,enabled:policy.enabled[module]}))
}

export async function websiteTemplates(db:DatabaseExecutor):Promise<WebsiteTemplateRecord[]> {
 const latest = new Map<bigint, Awaited<ReturnType<typeof repo.revisions>>[number]>()
 for (const revision of await repo.revisions(db)) {
  if (!latest.has(revision.templateId)) latest.set(revision.templateId, revision)
 }
 const {policy}=await readWebsiteModulePolicy(db)
 const available=await repo.list(db)
 return available.map(t=>{
  const revision=latest.get(t.id)
  return {id:String(t.id),coverMediaId:t.coverMediaId?String(t.coverMediaId):null,key:t.key,name:t.name,description:t.description,enabledForNew:t.enabledForNew,metadataVersion:t.metadataVersion,definition:revision?.definition??null,revision:revision?.version??null,businessModules:templateBusinessModules(policy,t.key)}
 })
}

// 按显式页面绑定投影名称，不解析导航 URL；未登记页面仍保留其约束键。
export async function websiteTemplateCatalog(db:DatabaseExecutor):Promise<WebsiteTemplateCatalogRecord[]> {
 const [templates,menus]=await Promise.all([websiteTemplates(db),menuRepository.all(db)])
 const names=new Map(menus.filter(menu=>menu.pageKey==='website_page').map(menu=>[websitePageKey(menu.code),menu.name]))
 return templates.map(template=>({...template,applicablePages:!template.definition?null:template.definition.allowedPages==='all'?'all':template.definition.allowedPages.map(key=>({key,name:names.get(key)??null}))}))
}
