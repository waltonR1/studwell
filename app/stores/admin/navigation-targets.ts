// 独立管理站内链接目标查询；不依赖页面草稿，身份切换或编辑作用域结束后丢弃迟到响应。
import {defineStore} from 'pinia'
import {ref,watch} from 'vue'
import type {SiteTarget} from '#shared/types/admin/site-settings'
import {createSiteNavigationTargetsApi} from '~/api/admin/navigation-targets'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'

export const useAdminNavigationTargetsStore=defineStore('admin-navigation-targets',()=>{
 const request=useAdminRequestStore(),session=useAdminSessionStore(),api=createSiteNavigationTargetsApi(request)
 const navigationTargets=ref<SiteTarget[]>([]),navigationTargetsPending=ref(false),navigationTargetsLoaded=ref(false),navigationTargetsError=ref('')
 let sequence=0
 function reset(){sequence++;navigationTargets.value=[];navigationTargetsPending.value=false;navigationTargetsLoaded.value=false;navigationTargetsError.value=''}
 async function loadNavigationTargets(force=false){
  if(!force&&(navigationTargetsPending.value||navigationTargetsLoaded.value))return
  const token=++sequence,generation=session.generation
  const current=()=>token===sequence&&generation===session.generation
  navigationTargetsPending.value=true;navigationTargetsError.value=''
  try{const targets=await api.read();if(current()){navigationTargets.value=targets;navigationTargetsLoaded.value=true}}
  catch(error){if(current())navigationTargetsError.value=request.message(error)||'跳转目标加载失败，请重试。'}
  finally{if(current())navigationTargetsPending.value=false}
 }
 watch(()=>session.generation,reset,{flush:'sync'})
 return {navigationTargets,navigationTargetsPending,navigationTargetsLoaded,navigationTargetsError,loadNavigationTargets,reset}
})
