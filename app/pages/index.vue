<!-- 首页入口：读取发布首页，正文与页脚统一交给 ContentPage 装配。 -->
<script setup lang="ts">
import ContentPage from '~/components/public/runtime/routes/ContentPage.vue'
import {detailTemplates,sectionBehaviors} from '~/composables/public/sections/pageExtensions'
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import {usePageSeo} from '~/composables/public/runtime/seo/usePageSeo'
definePageMeta({siteHome:true})
const {settings,ready}=useSiteSettings()
await ready
const pageKey=Object.values(settings.value?.pages??{}).find(page=>page.path==='/')?.key
if(!pageKey)throw createError({statusCode:404,statusMessage:'Home route is unavailable'})
usePageSeo(pageKey)
</script>
<template>
  <ContentPage :page-key="pageKey" :detail-templates="detailTemplates" :section-behaviors="sectionBehaviors" observe-scenes />
</template>
