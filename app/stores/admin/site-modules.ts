// 按模块隔离状态和请求；使用者退出或身份权限变化时清理，写操作返回业务结果。
import {defineStore} from 'pinia'
import {reactive,watch} from 'vue'
import {siteModuleCatalog,siteModuleNames,type SiteModuleName} from '#shared/config/site-modules'
import type {SiteModuleState} from '#shared/types/admin/site-modules'
import type {AdminActionResult} from '~/types/admin/action-result'
import {createSiteModulesApi} from '~/api/admin/site-modules'
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
function empty(){return {state:null as SiteModuleState|null,pending:false,saving:false,error:'',blockedByReferences:false}}
export const useAdminSiteModulesStore=defineStore('admin-site-modules',()=>{
 const request=useAdminRequestStore(),session=useAdminSessionStore(),api=createSiteModulesApi(request)
 const entries=reactive(Object.fromEntries(siteModuleNames.map(name=>[name,empty()])) as Record<SiteModuleName,ReturnType<typeof empty>>)
 // 计数和请求代次属于生命周期，不进入可序列化业务状态。
 const epochs=new Map<SiteModuleName,number>(),consumers=new Map<SiteModuleName,number>()
 const canRead=(name:SiteModuleName)=>session.authenticated&&(session.can(siteModuleCatalog[name].readPermission)||(name==='inquiries'&&session.can('content.inquiries.settings')))
 const canUpdate=(name:SiteModuleName)=>session.isRoot&&session.can(siteModuleCatalog[name].updatePermission)
 const next=(name:SiteModuleName)=>{const token=(epochs.get(name)??0)+1;epochs.set(name,token);return token}
 const current=(name:SiteModuleName,token:number,generation:number)=>epochs.get(name)===token&&session.generation===generation&&canRead(name)
 function reset(name:SiteModuleName){next(name);Object.assign(entries[name],empty())}
 function acquire(name:SiteModuleName){consumers.set(name,(consumers.get(name)??0)+1)}
 function release(name:SiteModuleName){const count=(consumers.get(name)??0)-1;if(count>0)consumers.set(name,count);else{consumers.delete(name);reset(name)}}
 async function load(name:SiteModuleName){
  const entry=entries[name]
  if(!canRead(name)||entry.saving)return
  const token=next(name),generation=session.generation
  entry.pending=true;entry.state=null;entry.error=''
  try{const value=await api.read(name);if(current(name,token,generation))entry.state=value}
  catch(cause){if(current(name,token,generation))entry.error=request.operationMessage(cause)}
  finally{if(current(name,token,generation))entry.pending=false}
 }
 async function toggle(name:SiteModuleName):Promise<AdminActionResult|null>{
  const entry=entries[name]
  if(!entry.state||!canRead(name)||!canUpdate(name)||entry.pending||entry.saving)return null
  const token=next(name),generation=session.generation,body={version:entry.state.version,enabled:!entry.state.enabled}
  entry.saving=true;entry.error='';entry.blockedByReferences=false
  try{
   const value=await api.update(name,body)
   if(!current(name,token,generation))return null
   entry.state=value
   return {status:'success',message:siteModuleCatalog[name].name+'业务已'+(value.enabled?'启用。':'停用。')}
  }catch(cause){
   if(!current(name,token,generation))return null
   const failure=getAdminRequestFailure(cause),generic=request.operationMessage(cause)
   const message=generic?failure?.fields?.join('；')||generic:''
   const referenced=failure?.reason==='REFERENCED'
   entry.saving=false
   const refresh=load(name),refreshEpoch=epochs.get(name)!
   await refresh
   if(!current(name,refreshEpoch,generation))return null
   entry.blockedByReferences=referenced
   const count=entry.state?.usages.length??0
   return message?{status:'error',message:referenced&&count?siteModuleCatalog[name].name+'仍被 '+count+' 个已发布页面使用，请先处理引用。':message}:null
  }finally{if(current(name,token,generation))entry.saving=false}
 }
 watch(()=>session.generation,()=>siteModuleNames.forEach(reset),{flush:'sync'})
 watch(()=>siteModuleNames.map(canRead),(values,previous)=>{values.forEach((allowed,index)=>{if(!allowed&&previous[index])reset(siteModuleNames[index]!)})},{flush:'sync'})
 return {entries,canRead,canUpdate,acquire,release,load,toggle}
})
