import {useReleaseCleanup} from './useReleaseCleanup'
import {computed} from 'vue'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'
import {useWebsitePageActions} from './useWebsitePageActions'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import type {WebsiteMaintenanceAdapter,PageMaintenanceContent,PageMaintenanceDetail} from '~/types/admin/website-maintenance'
export function usePageMaintenance(key:string,locale:()=>SiteLocale):WebsiteMaintenanceAdapter<PageMaintenanceContent,PageMaintenanceDetail> {
 const store=useAdminWebsitePagesStore(),actions=useWebsitePageActions()
 const view=computed(()=>{
  const record=store.record,publication=record?.publication,dirty=store.dirty||store.assemblyEditorDirty
  const status=publication?{unpublished:'尚未发布',published:'已发布',offline:'已下线'}[publication.status]+(publication.status==='published'&&publication.changed?' · 草稿有待发布修改':''):undefined
  return {title:record?.name||actions.removedName.value||'网页维护',description:'维护页面设置和内容区块。',className:'website-page-module',
   ready:!!record&&!!store.draft,loading:store.pending,loadError:store.loadError,saveError:store.saveError,dirty,busy:store.busy,saving:store.saving,canEdit:store.canEdit,canPublish:store.canPublish,
   historyEnabled:!!record?.persisted,saveEnabled:store.dirty&&!store.assemblyEditorDirty&&store.placementIssues.length===0,
   publishEnabled:!dirty&&!!publication?.changed,status,showLocale:true,deleted:store.deleted,
   showWithdraw:store.canPublish&&publication?.status==='published',withdrawDisabled:store.busy||dirty,releases:publication?.releases??[],currentReleaseId:publication?.publishedReleaseId??null}
 })
 const cleanupRelease=useReleaseCleanup(actions.confirm,actions.toast,id=>store.cleanupRelease(id))
 return {cleanupRelease,key:'website-'+key+'-settings',view,contentProps:computed(()=>({locale:locale(),actions})),detailProps:computed(()=>({locale:locale()})),
  toast:actions.toast,confirmation:actions.confirm,historyOpen:actions.historyOpen,enter:()=>store.enter(key,'settings'),leave:()=>store.leave(key,'settings'),load:()=>store.load(),save:actions.save,publish:actions.publish,withdraw:actions.withdraw,
  resetUi:()=>{actions.toast.dismiss();actions.historyOpen.value=false;actions.deleteOpen.value=false}}
}
