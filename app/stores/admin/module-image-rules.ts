// 在当前编辑作用域共享模块图片规则，管理加载、重试和身份权限隔离。
import {defineStore} from 'pinia'
import {computed,ref,watch} from 'vue'
import type {ModuleImageRules} from '#shared/schemas/admin/image-rules'
import {createModuleImageRulesApi} from '~/api/admin/module-image-rules'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
export const useAdminModuleImageRulesStore=defineStore('admin-module-image-rules',()=>{
 const request=useAdminRequestStore(),session=useAdminSessionStore(),api=createModuleImageRulesApi(request)
 const rules=ref<ModuleImageRules>(),pending=ref(false),error=ref('')
 const canRead=computed(()=>session.can('content.media.read'))
 let sequence=0,consumers=0
 function reset(){sequence++;rules.value=undefined;pending.value=false;error.value=''}
 function acquire(){consumers++}
 function release(){consumers=Math.max(0,consumers-1);if(!consumers)reset()}
 async function load(force=false){
  if(!canRead.value||pending.value||(!force&&rules.value))return
  const token=++sequence,generation=session.generation
  pending.value=true;error.value=''
  const current=()=>token===sequence&&generation===session.generation&&canRead.value
  try{const data=await api.read();if(current())rules.value=data}
  catch(cause){if(current())error.value=request.operationMessage(cause)||'图片规则加载失败，请重试。'}
  finally{if(current())pending.value=false}
 }
 watch(()=>session.generation,reset,{flush:'sync'})
 watch(canRead,allowed=>{if(!allowed)reset()},{flush:'sync'})
 return {rules,pending,error,canRead,acquire,release,load}
})
