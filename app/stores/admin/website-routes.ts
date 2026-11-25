// 路由与 SEO 草稿、版本和异步操作；不处理确认框、Toast 或路由导航。
import {defineStore} from 'pinia'
import {computed,ref,watch} from 'vue'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import {supportedLocales,adminContentLocale} from '#shared/config/site-languages'
import {parseWebsiteRoutePattern} from '#shared/utils/website/route-pattern'
import type {WebsiteSiteConfigTree as Tree,WebsiteSiteSeoEntry} from '#shared/types/admin/website-site-config'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {projectWebsiteRouteTree} from '#shared/utils/website/route-tree'
import type {WebsiteRouteNode} from '#shared/types/website/route'
import type {AdminActionResult} from '~/types/admin/action-result'
import {createWebsiteRoutesApi} from '~/api/admin/website-routes'
import {createPublicationHistoryApi} from '~/api/admin/publication-history'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
export const useAdminWebsiteRoutesStore=defineStore('admin-website-routes',()=>{
 const request=useAdminRequestStore(),session=useAdminSessionStore(),api=createWebsiteRoutesApi(request)
 const empty:Tree={modulePolicy:{version:0,policy:{enabled:{news:false,careers:false,inquiries:true},pages:{},templates:{}}},draft:[],online:[],pages:[],version:0,publishedReleaseId:null,releases:[],seo:[],publishedSeo:[]}
 const record=ref<Tree|null>(null)
 const tree=computed({get:()=>record.value??empty,set:value=>{record.value=value}})
 const loading=ref(false),loadError=ref('')
 let lifetime=0
 const active=(revision:number,generation:number)=>revision===lifetime&&generation===session.generation
 async function load(){
  const revision=++lifetime,generation=session.generation
  loading.value=true;loadError.value='';error.value=''
  try{
   const data=await api.read()
   if(!active(revision,generation))return
   tree.value=data
   editorOpen.value=false
  }catch(cause){if(active(revision,generation))loadError.value=request.operationMessage(cause)}
  finally{if(active(revision,generation))loading.value=false}
 }
 const editLocales=computed(()=>supportedLocales)
 watch(editLocales,values=>{if(!values.includes(seoLocale.value))seoLocale.value=values[0]!})
 const form=ref({id:null as string|null,parentId:'',slug:'',targetType:'group' as WebsiteRouteNode['targetType'],resourceId:''})
 const editorOpen=ref(false)
 const pending=ref(false),error=ref('')
 const busy=computed(()=>pending.value||loading.value)
 const target=computed(()=>tree.value.pages.find(page=>page.id===form.value.resourceId))
 const dynamicRoute=computed(()=>form.value.targetType==='page'&&!!parseWebsiteRoutePattern('/preview/'+form.value.slug.trim())?.parameter)
 const seoLocale=ref<SiteLocale>(adminContentLocale)
 const seoEntries=ref<WebsiteSiteSeoEntry[]>([])
 const seoEntry=computed(()=>seoEntries.value.find(entry=>entry.locale===seoLocale.value))
 const seoTarget=computed(()=>{
  const {resourceId,targetType}=form.value
  if(targetType!=='page'||!target.value||dynamicRoute.value)return null
  return {resourceId}
 })
 const seoBaseline=ref('[]'),routeBaseline=ref('')
 function loadSeo(){
  const selected=seoTarget.value
  seoEntries.value=selected?editLocales.value.map(locale=>{
   const saved=tree.value.seo.find(entry=>entry.resourceId===selected.resourceId&&entry.locale===locale)
   return {locale,title:saved?.title??'',description:saved?.description??'',indexable:saved?.indexable??true,ogTitle:saved?.ogTitle??'',ogDescription:saved?.ogDescription??'',ogMediaId:saved?.ogMediaId??null}
  }):[]
  seoBaseline.value=JSON.stringify(seoEntries.value)
 }
 watch(()=>JSON.stringify(seoTarget.value),loadSeo,{flush:'sync'})
 const preview=computed(()=>{
  const f=form.value
  try{return projectWebsiteRouteTree([...tree.value.draft.filter(node=>node.id!==f.id),{...f,slug:f.slug.trim(),id:f.id??'new',parentId:f.parentId||null,resourceId:f.targetType==='group'?null:f.resourceId||null}])}
  catch{return []}
 })
 const proposed=computed(()=>preview.value.find(node=>node.id===(form.value.id??'new'))?.path)
 const changed=computed(()=>preview.value.filter(node=>tree.value.draft.some(before=>before.id===node.id&&before.path!==node.path)))
 const pendingRemovals=computed(()=>tree.value.online.filter(route=>!tree.value.draft.some(node=>node.id===route.routeNodeId&&node.enabled!==false)))
 function select(node?:WebsiteRouteNode){
  if(busy.value||editorOpen.value)return
  error.value=''
  editorOpen.value=true
  form.value=node?{...node,parentId:node.parentId??'',resourceId:node.resourceId??''}:{id:null,parentId:'',slug:'',targetType:'group',resourceId:''}
  seoLocale.value=adminContentLocale
  routeBaseline.value=JSON.stringify(form.value)
  loadSeo()
 }
 const editorDirty=computed(()=>editorOpen.value&&(JSON.stringify(form.value)!==routeBaseline.value||JSON.stringify(seoEntries.value)!==seoBaseline.value))
 function closeEditor(){if(!busy.value){editorOpen.value=false;error.value=''}}
 async function run(action:(isActive:()=>boolean)=>Promise<AdminActionResult|null>, fieldValidation=false){
  if(busy.value||!record.value||!session.isRoot)return null
  const revision=lifetime,generation=session.generation
  const isActive=()=>active(revision,generation)
  pending.value=true;error.value=''
  try{return await action(isActive)}catch(cause){
   if(isActive()){
    const message=request.operationMessage(cause),failure=getAdminRequestFailure(cause)
    const detail=message?([...new Set(failure?.fields??[])].join('；')||message):''
    if(fieldValidation&&editorOpen.value&&failure?.code==='INVALID_INPUT')error.value=detail
    else if(detail)return {status:'error' as const,message:detail}
   }
   return null
  }finally{if(isActive())pending.value=false}
 }
 async function save(){
  return run(async isActive=>{
  const {id,parentId,slug,targetType,resourceId}=form.value
  const data=await api.mutate({action:'save',version:tree.value.version,id,parentId:parentId||null,slug:slug.trim(),targetType,resourceId:targetType==='group'?null:resourceId||null})
  if(!isActive())return null
  tree.value=data
  editorOpen.value=false;return {status:'success',message:'路由草稿已保存。'}
  },true)
 }
 async function remove(){
  const id=form.value.id
  if(!id)return null
  return run(async isActive=>{const data=await api.mutate({action:'delete',version:tree.value.version,id});if(!isActive())return null;tree.value=data;editorOpen.value=false;return {status:'success',message:'已删除路由草稿。'}})
 }
 async function setRouteEnabled(node:WebsiteRouteNode,enabled:boolean){
  if(editorOpen.value||node.targetType!=='page')return
  return run(async isActive=>{
   const data=await api.mutate({action:'set-enabled',version:tree.value.version,id:node.id,enabled})
   if(!isActive())return null
   tree.value=data
   return {status:'success',message:enabled?'已保存启用设置，发布后生效。':'已保存停用设置，发布后生效；路径和 SEO 保留。'}
  })
 }
 const saveSeo=()=>run(async isActive=>{
  if(!seoTarget.value)return null
  const data=await api.mutate({action:'seo',version:tree.value.version,...seoTarget.value,entries:seoEntries.value})
  if(!isActive())return null
  tree.value=data
  loadSeo()
  return {status:'success',message:'SEO 草稿已保存，发布后生效。'}
 },true)
 async function cleanupRelease(releaseId:string){
  if(editorOpen.value)return null
  return run(async isActive=>{
   await createPublicationHistoryApi(request).cleanup({kind:'routes',releaseId,version:tree.value.version,publishedReleaseId:tree.value.publishedReleaseId})
   const data=await api.read()
   if(!isActive())return null
   tree.value=data
   return {status:'success',message:'路由与 SEO 历史发布已清理，图片文件保留在媒体库。'}
  })
 }
 async function publish(releaseId?:string){
  if(busy.value||editorOpen.value)return
  return run(async isActive=>{
   await api.publish({version:tree.value.version,publishedReleaseId:tree.value.publishedReleaseId,...(releaseId?{releaseId}:{})})
   if(!isActive())return null
   const data=await api.read()
   if(!isActive())return null
   tree.value=data
   return {status:'success',message:releaseId?'路由与 SEO 已回滚。':'路由与 SEO 已发布。'}
  })
 }

 function reset(){
  lifetime++;record.value=null;editorOpen.value=false;loading.value=pending.value=false;error.value=loadError.value=''
  form.value={id:null,parentId:'',slug:'',targetType:'group',resourceId:''};seoEntries.value=[];seoBaseline.value='[]';routeBaseline.value='';seoLocale.value=adminContentLocale
 }
 const seoDirty=computed(()=>JSON.stringify(seoEntries.value)!==seoBaseline.value)
 watch(()=>session.generation,reset,{flush:'sync'})
 return {record,tree,loading,loadError,pending,error,busy,editLocales,form,editorOpen,target,dynamicRoute,seoLocale,seoEntries,seoEntry,seoTarget,editorDirty,seoDirty,proposed,changed,pendingRemovals,select,closeEditor,load,save,remove,setRouteEnabled,saveSeo,publish,cleanupRelease,reset}
})
