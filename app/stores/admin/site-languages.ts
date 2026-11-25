// 管理语言草稿、版本和请求生命周期；操作返回业务结果，由页面选择展示方式。
import {defineStore} from 'pinia'
import {computed,ref,watch} from 'vue'
import {defaultSiteLanguages} from '#shared/config/site-languages'
import type {SiteLanguageState} from '#shared/types/admin/site-languages'
import type {AdminActionResult} from '~/types/admin/action-result'
import {createSiteLanguagesApi} from '~/api/admin/site-languages'
import {createPublicationHistoryApi} from '~/api/admin/publication-history'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
export const useAdminSiteLanguagesStore=defineStore('admin-site-languages',()=>{
 const request=useAdminRequestStore(),session=useAdminSessionStore(),api=createSiteLanguagesApi(request)
 const record=ref<SiteLanguageState|null>(null),form=ref(structuredClone(defaultSiteLanguages)),loading=ref(false),pending=ref(false),error=ref(''),loadError=ref('')
 let lifetime=0,sequence=0
 const active=(life:number,generation:number)=>life===lifetime&&generation===session.generation
 const dirty=computed(()=>!!record.value&&JSON.stringify(form.value)!==JSON.stringify(record.value.languages)),busy=computed(()=>loading.value||pending.value)
 function reset(){lifetime++;sequence++;record.value=null;form.value=structuredClone(defaultSiteLanguages);loading.value=pending.value=false;error.value=loadError.value=''}
 async function load(){
  const token=++sequence,life=lifetime,generation=session.generation;loading.value=true;loadError.value=''
  try{const data=await api.read();if(token===sequence&&active(life,generation)){record.value=data;form.value=structuredClone(data.languages)}}
  catch(cause){if(token===sequence&&active(life,generation))loadError.value=request.operationMessage(cause)}
  finally{if(token===sequence&&active(life,generation))loading.value=false}
 }
 async function run(work:(current:()=>boolean)=>Promise<AdminActionResult|null>):Promise<AdminActionResult|null>{
  if(busy.value||!record.value||!session.isRoot)return null
  const life=lifetime,generation=session.generation,current=()=>active(life,generation)
  pending.value=true;error.value=''
  try{return await work(current)}catch(cause){if(current())error.value=request.operationMessage(cause);return null}
  finally{if(current())pending.value=false}
 }
 const save=()=>run(async current=>{
  const data=await api.save({version:record.value!.version,languages:{defaultLocale:form.value.defaultLocale,enabledLocales:[...form.value.enabledLocales]}})
  if(!current())return null
  record.value=data;form.value=structuredClone(data.languages)
  return {status:'success',message:'语言草稿已保存，发布后生效。'}
 })
 const publish=(releaseId?:string)=>run(async current=>{
  const state=record.value!
  await api.publish({version:state.version,publishedReleaseId:state.publishedReleaseId,...(releaseId?{releaseId}:{})})
  if(!current())return null
  await load()
  if(!current()||loadError.value)return null
  return {status:'success',message:releaseId?'站点语言已回滚。':'站点语言已发布。'}
 })
 const cleanupRelease=(releaseId:string)=>run(async current=>{
  const state=record.value!
  await createPublicationHistoryApi(request).cleanup({kind:'languages',releaseId,version:state.version,publishedReleaseId:state.publishedReleaseId})
  const data=await api.read()
  if(!current())return null
  record.value=data
  return {status:'success',message:'语言历史发布已清理。'}
 })
 watch(()=>session.generation,reset,{flush:'sync'})
 return {record,form,loading,pending,error,loadError,dirty,busy,load,reset,save,publish,cleanupRelease}
})
