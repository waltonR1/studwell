import {useReleaseCleanup} from './useReleaseCleanup'
// 语言维护界面适配：确认、通知及公共框架投影；草稿和请求由业务 store 管理。
import {storeToRefs} from 'pinia'
import {useAdminSiteLanguagesStore} from '~/stores/admin/site-languages'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import type {AdminActionResult} from '~/types/admin/action-result'
import type {WebsiteMaintenanceAdapter,LanguageMaintenanceContent} from '~/types/admin/website-maintenance'
export function useLanguageMaintenance(){
 const session=useAdminSessionStore(),store=useAdminSiteLanguagesStore(),confirm=useAdminActionConfirm(),toast=useAdminToast()
 if(!session.isRoot)throw createError({statusCode:403,statusMessage:'Forbidden'})
 const {record,form,loading,error,loadError,dirty,busy}=storeToRefs(store)
 const historyOpen=ref(false),load=store.load
 function notify(result:AdminActionResult|null){if(result)toast.show(result.message,result.status)}
 async function save(){notify(await store.save())}
 async function publish(releaseId?:string){
  if(busy.value||!record.value)return
  if(!await confirm.ask({title:releaseId?'回滚站点语言？':'发布站点语言？',message:'仅更新语言启用范围和默认语言，按线上路由、SEO 和内容校验；不发布其他草稿。',confirmLabel:releaseId?'确认回滚':'发布站点语言'}))return
  notify(await store.publish(releaseId))
 }
 function resetUi(){store.reset();historyOpen.value=false;toast.dismiss();confirm.settle(false)}
 const view=computed(()=>({title:'站点语言',description:'独立维护启用语言及默认语言；停用语言保留内容。',className:'site-languages',ready:!!record.value,loading:loading.value,loadError:loadError.value,saveError:error.value,dirty:dirty.value,busy:busy.value,saving:false,canEdit:true,canPublish:true,historyEnabled:!!record.value,saveEnabled:!!record.value&&dirty.value&&form.value.enabledLocales.length>0&&form.value.enabledLocales.includes(form.value.defaultLocale),publishEnabled:!!record.value&&!dirty.value&&!loadError.value,status:record.value?(record.value.publishedReleaseId?'已有发布版本':'尚未发布'):undefined,showLocale:false,deleted:false,showWithdraw:false,withdrawDisabled:true,releases:record.value?.releases??[],currentReleaseId:record.value?.publishedReleaseId??null}))
 const cleanupRelease=useReleaseCleanup(confirm,toast,id=>store.cleanupRelease(id))
 return {cleanupRelease,key:'admin-site-languages',view,contentProps:computed(()=>({record,form,busy})),detailProps:computed(()=>({})),historyOpen,toast,confirmation:confirm,load,enter:load,leave:resetUi,resetUi,save,publish} satisfies WebsiteMaintenanceAdapter<LanguageMaintenanceContent,object>
}
