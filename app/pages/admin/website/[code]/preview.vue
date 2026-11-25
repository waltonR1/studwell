<script setup lang="ts">
import {createWebsitePagesApi} from '~/api/admin/website-pages'
import {useAdminRequestStore} from '~/stores/admin/request'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {siteLocales} from '#shared/schemas/admin/site-settings'
import {provideWebsitePreview} from '~/composables/public/runtime/usePageContent'
import WebsitePagePreview from '~/components/admin/preview/WebsitePagePreview.vue'
import PreviewSurface from '~/components/admin/preview/PreviewSurface.vue'
import {usePreviewRequest} from '~/composables/admin/usePreviewRequest'
import type {PublicSiteSettings} from '#shared/types/public/website'
import {sampleSiteSettingsKey} from '~/composables/public/runtime/useSiteSettings'
import CorporateHeader from '~/components/public/runtime/layout/CorporateHeader.vue'
import CorporateFooter from '~/components/public/runtime/layout/CorporateFooter.vue'

definePageMeta({layout:false,admin:true,middleware:'admin',adminPermission:query=>query.section==='header'||query.section==='footer'?'content.site_settings.read':'content.pages.read',key:route=>route.fullPath})
defineI18nRoute(false)
const route = useRoute()
const key = websitePageKey(String(route.params.code))
const language = siteLocales.find(code=>code===route.query.locale)
if(route.query.locale!==undefined&&!language)throw createError({statusCode:400,statusMessage:'Unsupported preview locale'})
const mode=route.query.mode==='history'?'history':route.query.mode==='published'?'published':'draft'
const releaseId=route.query.releaseId===undefined?undefined:String(route.query.releaseId)
if(mode==='history'&&(route.query.section!==undefined||!releaseId))throw createError({statusCode:400,statusMessage:'Invalid history preview'})
const request=useAdminRequestStore()
const api = createWebsitePagesApi(request)
const section=route.query.section==='header'||route.query.section==='footer'?route.query.section:undefined
const {locale,loadLocaleMessages} = useI18n()
const sectionId=route.query.sectionId===undefined?undefined:String(route.query.sectionId)
const {data,error}=await usePreviewRequest(async()=>{
 const view=await (section
   ? request.read<PublicSiteSettings>('site-settings',{section,mode,locale:language}).then(settings=>({settings}))
   : api.preview(key,language,mode,sectionId,releaseId).then(page=>({page})))
 const actual='page' in view?view.page.page.locale:view.settings.locale
 await loadLocaleMessages(actual)
 locale.value=actual
 return view
},'无法读取预览内容，请确认页面或区块仍存在、所选版本可用且当前账号有查看权限。')
const preview=data&&'page'in data?data.page:undefined
const settings=data&&'settings'in data?data.settings:undefined
if(preview)provideWebsitePreview(preview)
if(settings)provide(sampleSiteSettingsKey,settings)
useHead({title:mode==='history'?'历史页面预览':mode==='published'?'预览已发布内容':'草稿预览',meta:[{name:'robots',content:'noindex,nofollow'}]})
</script>

<template>
  <WebsitePagePreview v-if="preview" :preview="preview" />
  <PreviewSurface v-else :error="error" :class="{'site-header-preview':section==='header'}">
    <CorporateHeader v-if="settings&&section==='header'" />
    <CorporateFooter v-if="settings&&section==='footer'" />
  </PreviewSurface>
</template>

<style scoped>
.site-header-preview.site-header-preview { --header-height:inherit; }
</style>
