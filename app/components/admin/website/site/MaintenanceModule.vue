<!-- 网站标识、页头和页脚维护入口：装配所属表单、预览及历史详情。 -->
<script setup lang="ts">
import {adminContentLocale} from '#shared/config/site-languages'
import type {SiteLocale,SiteSection} from '#shared/schemas/admin/site-settings'
import {useSiteMaintenance} from '~/composables/admin/website/useSiteMaintenance'
import MaintenanceFrame from '../shared/MaintenanceFrame.vue'
import PreviewDialog from '~/components/admin/preview/PreviewDialog.vue'
import SettingsContent from './SettingsContent.vue'
import ReleaseDetails from './ReleaseDetails.vue'
const {page}=defineProps<{page:SiteSection}>()
const locale=ref<SiteLocale>(adminContentLocale),previewSrc=ref<string>(),previewTitle=ref('预览已发布')
const adapter=useSiteMaintenance(page,()=>locale.value),view=adapter.view
function preview(mode:'draft'|'published'){
 previewTitle.value=mode==='draft'?'预览已保存草稿':'预览已发布'
 previewSrc.value='/admin/website/'+page+'/preview?'+new URLSearchParams({section:page,mode,locale:locale.value})
}
</script>
<template>
 <MaintenanceFrame v-model:locale="locale" :adapter="adapter">
  <template #actions>
   <template v-if="(page==='header'||page==='footer')&&view.ready">
    <UButton class="admin-button" :disabled="view.busy||!view.historyEnabled" title="不包含未保存的修改" @click="preview('draft')">预览已保存草稿</UButton>
    <UButton class="admin-button" :disabled="view.busy||!view.currentReleaseId" :title="view.currentReleaseId?'':'尚未发布'" @click="preview('published')">预览已发布</UButton>
   </template>
  </template>
  <SettingsContent v-bind="adapter.contentProps.value" />
  <template #detail="{releaseId,back}"><ReleaseDetails :key="releaseId" v-bind="adapter.detailProps.value" :release-id="releaseId" @back="back" /></template>
 </MaintenanceFrame>
 <PreviewDialog :open="!!previewSrc" :src="previewSrc" :title="previewTitle" @close="previewSrc=undefined" />
</template>
