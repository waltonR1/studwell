// 模块状态页面接线：选择模块、释放作用域，将业务结果转换为通知。
import {computed,onScopeDispose,ref,watch,type MaybeRefOrGetter,toValue} from 'vue'
import type {SiteModuleName} from '#shared/config/site-modules'
import {useAdminSiteModulesStore} from '~/stores/admin/site-modules'
import {useAdminSessionStore} from '~/stores/admin/session'
import type {AdminToastNotification} from '~/types/admin/interaction'
export function useBusinessModuleStatus(module:MaybeRefOrGetter<SiteModuleName>){
 const store=useAdminSiteModulesStore(),session=useAdminSessionStore()
 const name=computed(()=>toValue(module)),entry=computed(()=>store.entries[name.value])
 const notification=ref<AdminToastNotification|null>(null)
 let alive=true,epoch=0
 const canRead=computed(()=>store.canRead(name.value)),canUpdate=computed(()=>store.canUpdate(name.value))
 watch(name,(value,previous)=>{epoch++;notification.value=null;if(previous)store.release(previous);store.acquire(value)},{immediate:true,flush:'sync'})
 watch([()=>session.generation,canRead],()=>{epoch++;notification.value=null},{flush:'sync'})
 onScopeDispose(()=>{alive=false;epoch++;store.release(name.value)})
 const load=()=>store.load(name.value)
 async function toggle(){
  const token=epoch,generation=session.generation,selected=name.value
  notification.value=null
  const result=await store.toggle(selected)
  if(!alive||token!==epoch||generation!==session.generation||!canRead.value)return false
  if(result)notification.value={tone:result.status,message:result.message}
  return result?.status==='success'
 }
 return {state:computed(()=>entry.value.state),pending:computed(()=>entry.value.pending),saving:computed(()=>entry.value.saving),error:computed(()=>entry.value.error),blockedByReferences:computed(()=>entry.value.blockedByReferences),notification,canRead,canUpdate,load,toggle}
}
