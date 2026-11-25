// 图片规则的组件生命周期接线；媒体读取权限沿用服务端契约，不替代媒体选择器授权。
import {computed,onMounted,onScopeDispose,watch,toValue,type MaybeRefOrGetter} from 'vue'
import {storeToRefs} from 'pinia'
import {useAdminModuleImageRulesStore} from '~/stores/admin/module-image-rules'
import {useAdminSessionStore} from '~/stores/admin/session'
export function useModuleImageRules(enabled:MaybeRefOrGetter<boolean>=true){
 const store=useAdminModuleImageRulesStore(),session=useAdminSessionStore(),{rules,pending,error,canRead}=storeToRefs(store)
 const active=computed(()=>toValue(enabled)&&canRead.value)
 let mounted=false,acquired=false
 function sync(){
  if(!mounted)return
  if(active.value){if(!acquired){store.acquire();acquired=true}void store.load()}
  else if(acquired){store.release();acquired=false}
 }
 onMounted(()=>{mounted=true;sync()})
 watch([active,()=>session.generation],sync,{flush:'sync'})
 onScopeDispose(()=>{mounted=false;if(acquired)store.release()})
 const ready=computed(()=>!!rules.value)
 return {rules,pending,error,canRead,ready,retry:()=>store.load(true)}
}
