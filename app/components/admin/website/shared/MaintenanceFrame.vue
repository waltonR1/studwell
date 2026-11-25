<!-- 网站维护共用框架：协调生命周期和公共操作，通过插槽接收业务内容与动作。 -->
<script setup lang="ts">
import {adminContentLocale} from '#shared/config/site-languages'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import type {WebsiteMaintenanceController} from '~/types/admin/website-maintenance'
import {companyBrand} from '~/config/admin/brand'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminBusy,useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import '~/assets/admin/css/components/website-editor.css'
const {adapter}=defineProps<{adapter:WebsiteMaintenanceController}>()
const locale=defineModel<SiteLocale>('locale',{default:adminContentLocale})
const selectedRelease=ref<string|null>(null)
const slots=useSlots()
const view=adapter.view,historyOpen=adapter.historyOpen,toast=adapter.toast,confirmation=adapter.confirmation
function closeDetail(){selectedRelease.value=null}
const session=useAdminSessionStore()
useHead(()=>({title:view.value.title+' | '+companyBrand.name}))
useAdminBusy(()=>view.value.busy)
const unsaved=useAdminUnsavedGuard(()=>view.value.dirty,'未保存的修改将被放弃。')
onBeforeRouteLeave(()=>!view.value.busy)
watch(()=>session.generation,adapter.resetUi)
watch(historyOpen,()=>{selectedRelease.value=null})
async function reload(){if(!view.value.busy&&await unsaved.guard())await adapter.load()}
useAdminRefresh(async()=>{await adapter.load();if(view.value.loadError)throw new Error(view.value.loadError)},async()=>!view.value.busy&&await unsaved.guard())
onBeforeUnmount(adapter.leave)
await callOnce(adapter.key,adapter.enter,{mode:'navigation'})
</script>
<template>
 <section class="admin-module admin-view-page admin-view-detail website-maintenance" :class="view.className">
  <AdminCommonPageHeader :title="view.title" :description="view.description">
   <template #actions>
    <slot name="actions" />
    <UButton class="admin-button" :disabled="view.busy||!view.historyEnabled" @click="historyOpen=true">发布记录</UButton>
    <UButton v-if="view.canPublish" class="admin-button admin-button-primary" :disabled="view.busy||!view.publishEnabled" @click="adapter.publish()">发布</UButton>
    <UButton v-if="view.canEdit&&adapter.save" class="admin-button admin-button-primary" :disabled="view.busy||!view.saveEnabled" @click="adapter.save?.()">{{ view.saving?'保存中…':'保存草稿' }}</UButton>
    <UButton v-if="view.showWithdraw" class="admin-button" :disabled="view.withdrawDisabled" @click="adapter.withdraw?.()">下线</UButton>
   </template>
  </AdminCommonPageHeader>
  <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/>
  <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  <slot v-if="view.deleted" name="deleted"><AdminCommonDataState state="empty" title="资料已移除" /></slot>
  <AdminCommonDataState v-else-if="view.loading" state="loading" title="正在加载资料…"/>
  <AdminCommonDataState v-else-if="view.loadError" state="error" title="资料加载失败" :description="view.loadError"><template #action><UButton class="admin-button" @click="reload">重试</UButton></template></AdminCommonDataState>
  <template v-else-if="view.ready">
   <AdminWebsiteSharedEditorToolbar :dirty="view.dirty" :status="view.status" :locale="view.showLocale?locale:undefined" :disabled="view.busy" @update:locale="locale=$event"/>
   <AdminCommonFeedback v-if="view.saveError" tone="error">{{ view.saveError }}</AdminCommonFeedback>
   <AdminCommonFeedback v-if="!view.canEdit" tone="info">当前账号只有查看权限。</AdminCommonFeedback>
   <fieldset class="maintenance-content" :disabled="view.busy"><legend class="sr-only">{{ view.title }}</legend><slot /></fieldset>
  </template>
  <AdminCommonDialog :open="historyOpen&&!(slots.preview&&selectedRelease)" :title="view.title+'发布记录'" size="large" :busy="view.busy" @close="historyOpen=false">
   <slot v-if="slots.detail&&selectedRelease" name="detail" :release-id="selectedRelease" :back="closeDetail" />
   <AdminWebsiteSharedReleaseHistoryTable v-else :releases="view.releases" :current-id="view.currentReleaseId" :can-publish="view.canPublish&&!slots.preview&&!slots.detail" :can-cleanup="view.canPublish&&!!adapter.cleanupRelease" :show-detail="!!slots.detail||!!slots.preview" :view-label="slots.preview?'预览':'查看版本'" :busy="view.busy" @view="selectedRelease=$event" @restore="adapter.publish($event)" @cleanup="adapter.cleanupRelease?.($event)"/>
  </AdminCommonDialog>
  <slot v-if="historyOpen&&selectedRelease&&slots.preview" name="preview" :release-id="selectedRelease" :back="closeDetail" />
 </section>
</template>
