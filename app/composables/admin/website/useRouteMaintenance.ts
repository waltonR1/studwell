import {useReleaseCleanup} from './useReleaseCleanup'
// 路由维护界面适配：确认、通知、目录折叠和框架投影；业务草稿由 store 管理。
import {storeToRefs} from 'pinia'
import type {WebsiteRouteNode} from '#shared/types/website/route'
import {useAdminWebsiteRoutesStore} from '~/stores/admin/website-routes'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import type {AdminActionResult} from '~/types/admin/action-result'
import type {WebsiteMaintenanceAdapter} from '~/types/admin/website-maintenance'
export function useRouteMaintenance(){
 const store=useAdminWebsiteRoutesStore(),session=useAdminSessionStore(),confirm=useAdminActionConfirm(),toast=useAdminToast()
 if(!session.isRoot)throw createError({statusCode:403,statusMessage:'Forbidden'})
 const {record,tree,loading,loadError,error,busy,editLocales,form,editorOpen,target,dynamicRoute,seoLocale,seoEntry,seoTarget,editorDirty,proposed,changed,pendingRemovals}=storeToRefs(store)
 const historyOpen=ref(false),load=store.load,select=store.select
 async function notify(work:()=>Promise<AdminActionResult|null|undefined>){toast.dismiss();const result=await work();if(result)toast.show(result.message,result.status)}
 async function closeEditor(){
  if(busy.value)return
  if(editorDirty.value&&!await confirm.ask({title:'放弃未保存的修改？',message:'未保存的路由和 SEO 修改将被放弃。',confirmLabel:'放弃修改'}))return
  store.closeEditor()
 }
 async function save(){
  if(store.seoDirty&&!await confirm.ask({title:'放弃未保存的 SEO 修改？',message:'保存路由后会关闭编辑窗口，SEO 草稿需要单独保存。',confirmLabel:'仅保存路由'}))return
  await notify(store.save)
 }
 async function remove(){
  if(!form.value.id||!await confirm.ask({title:'删除路由草稿？',message:'当前公开地址保留到下一次发布。',confirmLabel:'删除草稿'}))return
  await notify(store.remove)
 }
 const saveSeo=()=>notify(store.saveSeo)
 const setRouteEnabled=(node:WebsiteRouteNode,enabled:boolean)=>notify(()=>store.setRouteEnabled(node,enabled))
 async function publish(releaseId?:string){
  if(busy.value||editorOpen.value)return
  if(!await confirm.ask({title:releaseId?'回滚路由与 SEO？':'发布路由与 SEO？',message:releaseId?'仅恢复所选版本的路由和 SEO；语言配置与草稿保持原样。':'仅发布路由和 SEO 草稿，按当前已启用语言校验；语言配置保持原样。',confirmLabel:releaseId?'确认回滚':'发布路由与 SEO'}))return
  await notify(()=>store.publish(releaseId))
 }
 const sorted=computed(()=>[...tree.value.draft].sort((a,b)=>a.path.localeCompare(b.path)))
 const collapsed=ref(new Set<string>())
 const onlineByNode=computed(()=>new Map(tree.value.online.map(row=>[row.routeNodeId,row.path])))
 const treeRows=computed(()=>{
  const children=new Map<string|null,typeof sorted.value>()
  for(const node of sorted.value){
   const siblings=children.get(node.parentId)??[]
   siblings.push(node)
   children.set(node.parentId,siblings)
  }
  function flatten(parent:string|null,depth:number):Array<(typeof sorted.value)[number]&{name:string;visible:boolean;depth:number;hasChildren:boolean}>{
   return (children.get(parent)??[]).flatMap(node=>[
    {...node,name:node.path,visible:true,depth,hasChildren:children.has(node.id)},
    ...(collapsed.value.has(node.id)?[]:flatten(node.id,depth+1)),
   ])
  }
  return flatten(null,0)
 })
 const targetLabels={group:'分组',page:'页面'}
 function toggleNode(id:string){
  if(collapsed.value.has(id))collapsed.value.delete(id)
  else collapsed.value.add(id)
 }
 function routeStatus(node:WebsiteRouteNode){
  if(node.targetType==='group')return '—'
  const online=onlineByNode.value.has(node.id)
  return node.enabled===false?(online?'待停用':'已停用'):(online?'已启用':'待启用')
 }
 const editor={tree,editLocales,form,editorOpen,busy,error,target,dynamicRoute,seoLocale,seoEntry,seoTarget,sorted,collapsed,onlineByNode,treeRows,targetLabels,toggleNode,proposed,changed,pendingRemovals,routeStatus,setRouteEnabled,select,save,remove,saveSeo,closeEditor}
 function resetUi(){store.reset();collapsed.value.clear();historyOpen.value=false;toast.dismiss();confirm.settle(false)}
 const view=computed(()=>({
  title:'路由与 SEO',description:'独立维护并发布公开路径和页面 SEO，按当前已启用语言校验。',className:'website-routes',
  ready:!!record.value,loading:loading.value,loadError:loadError.value,saveError:editorOpen.value?'':error.value,
  dirty:editorDirty.value,busy:busy.value,saving:false,canEdit:true,canPublish:true,
  historyEnabled:!!record.value,saveEnabled:false,publishEnabled:!!record.value&&!loadError.value&&!editorOpen.value,
  status:record.value?(tree.value.publishedReleaseId?'已有发布版本':'尚未发布'):undefined,
  showLocale:false,deleted:false,showWithdraw:false,withdrawDisabled:true,releases:tree.value.releases,currentReleaseId:tree.value.publishedReleaseId,
 }))
 const cleanupRelease=useReleaseCleanup(confirm,toast,id=>store.cleanupRelease(id))
 return {cleanupRelease,key:'admin-website-routes',view,contentProps:computed(()=>({editor})),detailProps:computed(()=>({})),
  historyOpen,toast,confirmation:confirm,load,enter:load,leave:resetUi,resetUi,publish,
  newRoute:()=>select()} satisfies WebsiteMaintenanceAdapter<object,object> & {newRoute:()=>void}
}
