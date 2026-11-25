// 协调页面删除、关联清理及权限审计，持久化由仓储执行。
import {readSeo,seoOwner,removePageSeo,lockSiteConfig} from '../repositories/website-site-config'
import {readRouteNodes,readPublishedRoutes} from '../repositories/website-route-tree'
import {requirePermission} from './access/permissions'
import type {Database} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {websitePageRepository as pages} from '../repositories/website-pages'
import {menuRepository as menus} from '../repositories/menus'
import {roleRepository as roles} from '../repositories/roles'
import {mediaRepository} from '../repositories/media'
import {websitePageDeleteSchema} from '#shared/schemas/admin/website-pages'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {authorizeWebsite,authorizePageScope,pageMenu} from './website-access'
import {publishedPageReferences} from './website-navigation-references'
import {auditedWrite} from './operations/audited-write'
import {auditService} from './audit'
import {auditChanges} from '../policies/audit-changes'

export function createWebsitePageDeletionService(db:Database){return {
 async remove(actor:bigint,key:string,raw:unknown,meta:AuthMeta){
  const input=await parseInput(websitePageDeleteSchema,raw)
  if(input.confirmation!==key)throw new ApiError('INVALID_INPUT',[{path:'confirmation',message:'请输入正确的页面编码。'}])
  return auditedWrite(db,{actor,meta,action:'website.page.purge',id:input.resourceId?BigInt(input.resourceId):null,targetType:'site_settings',targetName:key,isolationLevel:'read committed'},async tx=>{
   await lockSiteConfig(tx)
   const initial=await resources.find(tx,`page.${key}`)
   if(initial){
    if(initial.type!=='page')throw new ApiError('NOT_FOUND')
    await authorizeWebsite(tx,actor,initial,'delete')
   }else{await requirePermission(tx,actor,'content.pages.delete');await authorizePageScope(tx,actor,key)}
   const originalMenu=await pageMenu(tx,key)
   const bindings=await menus.bindingsForMenu(tx,originalMenu.id)
   // Role authorization locks roles before menus. Follow that order and retry if a new role binding raced us.
   const lockedRoles:Array<NonNullable<Awaited<ReturnType<typeof roles.find>>>>=[]
   for(const binding of bindings){const role=await roles.find(tx,binding.roleId,true);if(!role)throw conflictError('RETRY','references');lockedRoles.push(role)}
   const rows=await menus.all(tx,true),menu=rows.find(row=>row.id===originalMenu.id&&row.pageKey==='website_page'&&websitePageKey(row.code)===key)
   if(!menu)throw new ApiError('NOT_FOUND')
   if(rows.some(row=>row.parentId===menu.id))throw conflictError('REFERENCED','references')
   const currentBindings=await menus.bindingsForMenu(tx,menu.id)
   if(currentBindings.some(binding=>!lockedRoles.some(role=>role.id===binding.roleId)))throw conflictError('RETRY','references')
   const resource=await resources.find(tx,`page.${key}`,true)
   if(resource){
    if(resource.type!=='page')throw new ApiError('NOT_FOUND')
    await authorizeWebsite(tx,actor,resource,'delete')
    if(String(resource.id)!==input.resourceId||resource.draftVersion!==input.version||resource.stateVersion!==input.stateVersion)throw conflictError('STALE','version')
   }else if(input.resourceId!==null||input.version!==1||input.stateVersion!==1)throw conflictError('STALE','version')
   if(resource?.publishedReleaseId)throw new ApiError('INVALID_INPUT',[{path:'publication',message:'请先下线页面，再永久删除。'}])
   if(resource&&((await readRouteNodes(tx)).some(route=>route.resourceId===resource.id)||(await readPublishedRoutes(tx)).some(route=>route.resourceId===resource.id)))throw new ApiError('CONFLICT',[{path:'routes',message:'请先移除页面的路由草稿及已发布路由。'}],undefined,'REFERENCED')
   const state=resource?await pages.removalState(tx,resource.id,key):{hasNavigation:false}
   if(state.hasNavigation)throw new ApiError('CONFLICT',[{path:'navigation',message:'页头或页脚的工作草稿仍引用此页面，请先移除引用并保存。'}],undefined,'REFERENCED')
   if((await publishedPageReferences(tx,key)).length)throw conflictError('PAGE_LINKED','navigation')
   const inventory=resource?await pages.deletionInventory(tx,resource.id):{sections:[],releases:[]}
   await mediaRepository.removeReferencesForOwners(tx,[...inventory.sections.map(section=>`website:section:${section.id}`),...inventory.releases.map(release=>`website:release:${release.id}`)])
   if(resource){
    const seo=(await readSeo(tx,true)).filter(row=>row.resourceId===String(resource.id))
    await mediaRepository.removeReferencesForOwners(tx,[...new Set(seo.map(seoOwner))])
    await removePageSeo(tx,resource.id)
    await pages.purge(tx,resource.id)
   }
   for(const role of lockedRoles){if(!currentBindings.some(binding=>binding.roleId===role.id))continue;if(!await roles.update(tx,role.id,role.version,actor,{}))throw conflictError('STALE','references')}
   await menus.removeMenuBindings(tx,menu.id)
   await menus.remove(tx,menu.id)
   await auditService.write(tx,{...meta,actorId:actor,action:'menus.delete',targetType:'menu',targetId:String(menu.id),targetName:menu.name,result:'success',createdAt:new Date(),changeContext:auditChanges('menu',menu,null)})
   return {id:resource?.id??menu.id,name:menu.name,changes:auditChanges('site_settings',{settingsFields:`页面、草稿、${inventory.sections.length} 个区块、${inventory.releases.length} 条发布历史、菜单及 ${currentBindings.length} 项菜单授权`},null),value:{deleted:true as const}}
  })
 },
}}
