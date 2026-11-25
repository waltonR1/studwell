import {useReleaseCleanup} from './useReleaseCleanup'
import {computed} from 'vue'
import {useAdminSiteSettingsStore} from '~/stores/admin/site-settings'
import {useSiteSettingsActions} from './useSiteSettingsActions'
import type {SiteLocale,SiteSection} from '#shared/schemas/admin/site-settings'
import type {WebsiteMaintenanceAdapter,SiteMaintenanceContent,SiteMaintenanceDetail} from '~/types/admin/website-maintenance'
export function useSiteMaintenance(page:SiteSection,locale:()=>SiteLocale):WebsiteMaintenanceAdapter<SiteMaintenanceContent,SiteMaintenanceDetail> {
 const store=useAdminSiteSettingsStore()
 const title={basic:'网站标识',header:'页头维护',footer:'页脚维护'}[page]
 const actions=useSiteSettingsActions({section:()=>page,title:()=>title,locale})
 const view=computed(()=>{
  const publication=store.record?.publication?.[page],dirty=store.dirty||store.editorDirty
  const status=publication?(!publication.publishedReleaseId?'尚未发布':publication.changedSections.length===0?'当前草稿已发布':'草稿有待发布修改'):undefined
  return {title,description:{basic:'维护网站 Logo 和浏览器图标。',header:'维护页头导航和展开菜单介绍文字。',footer:'维护页脚简介、链接、版权和联系资料；联系资料仅用于页脚。'}[page],className:'site-settings',
   ready:!!store.record,loading:store.pending&&!store.record,loadError:store.loadError,saveError:store.saveError,dirty,busy:store.busy,saving:store.saving,canEdit:store.canEdit,canPublish:store.canPublish,
   historyEnabled:!!publication,saveEnabled:store.dirtySections.includes(page)&&!store.pending&&!store.editorDirty,publishEnabled:!dirty&&!!publication&&publication.changedSections.length>0,
   status,showLocale:page!=='basic',deleted:false,showWithdraw:false,withdrawDisabled:true,releases:publication?.releases??[],currentReleaseId:publication?.publishedReleaseId??null}
 })
 const cleanupRelease=useReleaseCleanup(actions.confirmation,actions.toast,id=>store.cleanupRelease(page,id))
 return {cleanupRelease,key:'admin-site-settings-'+page,view,contentProps:computed(()=>({page,locale:locale(),actions})),detailProps:computed(()=>({section:page,targets:store.record?.targets??[]})),
  toast:actions.toast,confirmation:actions.confirmation,historyOpen:actions.historyOpen,enter:()=>store.enter(page),leave:()=>store.leave(page),load:async()=>{store.closeEditor();await store.load()},save:()=>actions.save(page),publish:actions.publish,
  resetUi:()=>{actions.toast.dismiss();actions.historyOpen.value=false}}
}
