<!-- 页面维护入口：解析页面身份并装配表单、预览和历史详情。 -->
<script setup lang="ts">
import {adminContentLocale} from '#shared/config/site-languages'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {usePageMaintenance} from '~/composables/admin/website/usePageMaintenance'
import MaintenanceFrame from '../shared/MaintenanceFrame.vue'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'
import SettingsContent from './SettingsContent.vue'
import ReleasePreview from './ReleasePreview.vue'
const route=useRoute(),locale=ref<SiteLocale>(adminContentLocale),previewSrc=ref<string>()
const adapter=usePageMaintenance(websitePageKey(String(route.params.code)),()=>locale.value),view=adapter.view
function preview(){previewSrc.value='/admin/website/'+encodeURIComponent(String(route.params.code))+'/preview?mode=published&locale='+locale.value}
</script>
<template>
 <MaintenanceFrame v-model:locale="locale" :adapter="adapter">
  <template #actions><UButton v-if="view.ready&&!view.deleted" class="admin-button" :disabled="view.busy||!view.currentReleaseId" :title="view.currentReleaseId?'':'页面内容尚未发布'" @click="preview">预览已发布页面</UButton></template>
  <SettingsContent v-bind="adapter.contentProps.value" />
  <template #preview="{releaseId,back}"><ReleasePreview :key="releaseId" v-bind="adapter.detailProps.value" :release-id="releaseId" :busy="view.busy" :can-publish="view.canPublish" @restore="adapter.publish(releaseId)" @back="back" /></template>
  <template #deleted><AdminCommonDataState state="empty" title="页面已永久删除" description="此页面的内容、发布历史和菜单入口已移除。"><template #action><NuxtLink to="/admin" class="admin-button">返回后台</NuxtLink></template></AdminCommonDataState></template>
 </MaintenanceFrame>
 <PreviewDialog :open="!!previewSrc" :src="previewSrc" title="预览已发布页面" @close="previewSrc=undefined" />
</template>
