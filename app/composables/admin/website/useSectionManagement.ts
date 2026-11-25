// 独立区块编辑入口的保存、预览、媒体投影和生命周期接线，不创建页面草稿副本。
import {adminContentLocale} from '#shared/config/site-languages'
import type {MediaSelection} from '#shared/types/image-presentation'
import {assignSharedImage} from '~/utils/admin/website/shared-image'
import {managedFormMedia} from '~/utils/admin/website/section-forms'
import {resolveSectionForm} from '~/utils/admin/website/section-form-definition'
import {useAdminDetailLabel} from '~/composables/admin/navigation/useAdminDetailLabel'
import {storeToRefs} from 'pinia'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'
import {useAdminSessionStore} from '~/stores/admin/session'
import {siteLocales, type SiteLocale} from '#shared/schemas/admin/site-settings'
import {useAdminRefresh, useAdminBusy} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'

export function useSectionManagement(){
const route = useRoute(), store = useAdminWebsitePagesStore(), session = useAdminSessionStore()
const {
  record,
  draft,
  section,
  pending,
  busy,
  saving,
  loadError,
  saveError,
  dirty,
  canEdit
} = storeToRefs(store)
const displayTitle=computed(()=>section.value?.name||'区块编辑')
const contentError=ref('')
const previewOpen=ref(false)
const saveEnabled = computed(() => dirty.value && !!section.value?.name.trim() && !contentError.value)

const id = String(route.params.id)
const toast = useAdminToast(), confirm = useAdminActionConfirm()

async function save() {
  toast.dismiss()
  if(contentError.value)return
  const result = await store.save()
  if (result) toast.show(result.message, result.status)
}

const confirmEntryRemove = (message?:string) => confirm.ask({
  title: '移除条目？',
  message: message??'保存当前区块后写入草稿。',
  confirmLabel: '移除',
  cancelLabel: '取消'
})
const requestedLocale=String(route.query.locale??adminContentLocale)
const locale=ref<SiteLocale>(siteLocales.includes(requestedLocale as SiteLocale)?requestedLocale as SiteLocale:adminContentLocale)
const pagePath=`/admin/website/${route.params.code}`
useAdminDetailLabel(() => section.value?.id === id ? displayTitle.value : undefined)
const backTo=pagePath,backLabel='返回页面管理'
useAdminBusy(() => store.busy)
const unsaved = useAdminUnsavedGuard(() => dirty.value||!!contentError.value, '未保存的修改将被放弃。')
onBeforeRouteLeave(() => !busy.value)
watch(() => session.generation, () => {
  toast.dismiss();
})
async function reload() {
  if (!busy.value && await unsaved.guard()) await store.load()
}

useAdminRefresh(async () => {
  await store.load();
  if (loadError.value) throw new Error(loadError.value)
}, async () => !busy.value && await unsaved.guard())
const templateUpgrade=computed(()=>store.templateUpgrade)
async function upgradeTemplate(){
 if(busy.value||dirty.value)return
 if(!await confirm.ask({title:'升级当前区块模板修订？',message:'将检查现有内容是否符合新配置。只更新区块草稿，当前公开页面和历史发布不变。',confirmLabel:'升级修订',cancelLabel:'取消'}))return
 const result=await store.upgradeTemplate()
 if(result)toast.show(result.message,result.status)
}
const remainingMedia = computed(() => {
  const managed = managedFormMedia(section.value?.definition?resolveSectionForm(section.value.definition):undefined);
  return section.value?.definition?.mediaSlots.filter(field=>!managed.has(field.key)).flatMap(field=>{
    const slot=section.value!.shared.media.find(slot=>slot.key===field.key)
    return slot?[{...slot,kind:field.kind,imagePreset:field.imagePreset}]:[]
  }) ?? []
})

function updateMedia(key: string, value: MediaSelection) {
  const slot = section.value?.shared.media.find(slot => slot.key === key);
  if (slot && canEdit.value && !busy.value) assignSharedImage(slot,value)
}

return {record,draft,section,pending,busy,saving,loadError,saveError,dirty,canEdit,displayTitle,contentError,previewOpen,saveEnabled,id,toast,confirm,save,confirmEntryRemove,locale,pagePath,backTo,backLabel,reload,remainingMedia,updateMedia,templateUpgrade,upgradeTemplate}
}
