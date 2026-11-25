// Module status changes serialize with publication without changing any drafts.
import {siteModuleCatalog,siteModuleNames,type SiteModuleName} from '#shared/config/site-modules'
import {siteModuleNameSchema,siteModuleUpdateSchema,type WebsiteModulePolicy} from '#shared/schemas/website/module-policy'
import type {SiteModuleState,SiteModuleUsage} from '#shared/types/admin/site-modules'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {ApiError,conflictError} from '../core/errors'
import {parseInput} from '../core/validation'
import {readWebsiteModulePolicy,saveWebsiteModulePolicy} from '../repositories/website-module-policy'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {lockSiteConfig} from '../repositories/website-site-config'
import {taskRepository} from '../repositories/tasks'
import {requirePermission,getPermissionSnapshot} from './access/permissions'
import {assertPublishedPolicyDependencies} from './website-publication-guards'
import {auditedWrite} from './operations/audited-write'
import {auditChanges} from '../policies/audit-changes'

export function publishedModuleUsage(policy:WebsiteModulePolicy,module:SiteModuleName,key:string,content:unknown):SiteModuleUsage|null {
 const page=content as {settings?:{displayName?:Record<string,string>};sections?:Array<{visible:boolean;templateKey:string;name?:string}>}|null
 const matching=(page?.sections??[]).filter(section=>section.visible&&policy.templates[section.templateKey]?.modules.includes(module))
 if(!policy.pages[key]?.includes(module)&&!matching.length)return null
 const names=page?.settings?.displayName
 return {key,name:names?.zh||Object.values(names??{}).find(Boolean)||key,sectionNames:matching.map(section=>section.name||section.templateKey)}
}
async function usages(db:DatabaseExecutor,policy:WebsiteModulePolicy,module:SiteModuleName){
 const result:SiteModuleUsage[]=[]
 for(const page of await resources.all(db)){
  if(page.type!=='page'||!page.publishedReleaseId)continue
  const release=await resources.release(db,page.publishedReleaseId,page.id)
  const usage=publishedModuleUsage(policy,module,page.key.slice(5),release?.content)
  if(usage)result.push(usage)
 }
 return result
}
// Caller must hold lockSiteConfig while validating and persisting a policy.
export async function assertDisabledModulesUnused(db:DatabaseExecutor,policy:WebsiteModulePolicy,modules:readonly SiteModuleName[]=siteModuleNames){
 for(const module of modules){
  if(policy.enabled[module])continue
  const references=await usages(db,policy,module)
  if(references.length)throw new ApiError('CONFLICT',[{path:'enabled',message:'请先移除并发布以下页面中的'+siteModuleCatalog[module].name+'引用，或下线这些页面：'+references.map(page=>page.name+' ('+page.key+')').join('、')}],undefined,'REFERENCED')
 }
}
async function state(db:DatabaseExecutor,module:SiteModuleName):Promise<SiteModuleState>{
 const {version,policy}=await readWebsiteModulePolicy(db)
 return {module,name:siteModuleCatalog[module].name,enabled:policy.enabled[module],version,usages:await usages(db,policy,module)}
}
export async function readSiteModuleState(db:Database,actor:bigint,rawModule:unknown){
 const module=await parseInput(siteModuleNameSchema,rawModule)
 return db.transaction(async tx=>{
  const access=await getPermissionSnapshot(tx,actor)
  if(!access.isRoot&&!access.permissions.includes(siteModuleCatalog[module].readPermission)&&!(module==='inquiries'&&access.permissions.includes('content.inquiries.settings')))throw new ApiError('FORBIDDEN')
  return state(tx,module)
 },{isolationLevel:'repeatable read'})
}
export async function updateSiteModuleState(db:Database,actor:bigint,rawModule:unknown,raw:unknown,meta:AuthMeta){
 const module=await parseInput(siteModuleNameSchema,rawModule),input=await parseInput(siteModuleUpdateSchema,raw)
 return auditedWrite(db,{actor,meta,id:module,targetType:'site_settings',targetName:siteModuleCatalog[module].name,action:'website.module.update',isolationLevel:'read committed'},async tx=>{
  if(!(await requirePermission(tx,actor,siteModuleCatalog[module].updatePermission)).isRoot)throw new ApiError('FORBIDDEN')
  await lockSiteConfig(tx)
  const current=await readWebsiteModulePolicy(tx)
  if(current.version!==input.version)throw conflictError('STALE','version')
  const policy={...current.policy,enabled:{...current.policy.enabled,[module]:input.enabled}}
  await assertDisabledModulesUnused(tx,policy,[module])
  await assertPublishedPolicyDependencies(tx,policy)
  await saveWebsiteModulePolicy(tx,policy,current.version)
  await taskRepository.requestSearchRebuild(tx)
  return {id:module,name:siteModuleCatalog[module].name,value:await state(tx,module),changes:auditChanges('site_settings',
   {settingsVersion:current.version,settingsSection:module,settingsFields:current.policy.enabled[module]?'enabled':'disabled'},
   {settingsVersion:current.version+1,settingsSection:module,settingsFields:input.enabled?'enabled':'disabled'})}
 })
}
