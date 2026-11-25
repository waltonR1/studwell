<script setup lang="ts">
import PreviewSurface from '~/components/admin/preview/PreviewSurface.vue'
import {providePreviewData} from '~/composables/admin/preview/providePreviewData'
import {usePreviewRequest} from '~/composables/admin/usePreviewRequest'
import type {WebsiteTemplateSample} from '#shared/types/admin/website-preview'
import {useAdminRequestStore} from '~/stores/admin/request'
import {provideWebsitePreview} from '~/composables/public/runtime/usePageContent'
import {resolveTemplatePreview} from '~/utils/admin/preview/resolveTemplatePreview.ts'
import SectionSamplePreview from '~/components/admin/preview/SectionSamplePreview.vue'

definePageMeta({layout:false,admin:true,middleware:'admin',adminPermission:'content.templates.read',adminTitle:'模板预览'})
defineI18nRoute(false)
const key=String(useRoute().params.key)
const {locale,loadLocaleMessages}=useI18n()
const {data:record,error}=await usePreviewRequest(async()=>{
 const record=await useAdminRequestStore().read<(WebsiteTemplateSample & {previewRendererPath: string})|null>('website-templates/'+encodeURIComponent(key)+'/sample')
 if(record){await loadLocaleMessages(record.view.page.locale);locale.value=record.view.page.locale}
 return record
},'模板样例读取失败，请确认模板仍存在且当前账号有查看权限。')
const sample=record?.view
if(record)providePreviewData(record,record.settings)
if(sample)provideWebsitePreview(sample)
const component=record?resolveTemplatePreview(record.previewRendererPath):undefined
useHead({title:(sample?.structure.displayName||key)+' · 模板预览',meta:[{name:'robots',content:'noindex,nofollow'}]})
</script>

<template>
 <PreviewSurface class="template-preview" :error="error" :class="sample && sample.structure.key+'-page'">
  <p v-if="!sample||!component" class="preview-message">模板库尚未保存此区块的样例。</p>
  <SectionSamplePreview v-else :sample="sample" :component="component" />
 </PreviewSurface>
</template>

<style scoped>
.template-preview { --header-height: 0px; --rule: #bec1c080; min-height: 100dvh; padding-top: 0; background: var(--surface-page); }
.preview-message { padding: 32px; }
</style>
