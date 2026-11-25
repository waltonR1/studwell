<!-- 新闻预览展示：布局与数据编排由预览 composable 提供。 -->
<script setup lang="ts">
import PreviewSurface from '~/components/admin/preview/PreviewSurface.vue'
import WebsitePagePreview from '~/components/admin/preview/WebsitePagePreview.vue'
import type {NewsContent} from '#shared/schemas/admin/news'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {useNewsArticlePreview} from '~/composables/admin/preview/useNewsArticlePreview'
import {provideWebsitePreview} from '~/composables/public/runtime/usePageContent'
const {content,locale}=defineProps<{content:NewsContent;locale:SiteLocale}>()
const {article,layout,layoutError,ready:rulesReady,error:rulesError,canRead:canReadRules,retry:retryRules}=await useNewsArticlePreview(()=>content,()=>locale)
// SFC 顶层 await 恢复 setup 上下文后再注入，不能在异步帮助函数中 await 后 provide。
if(layout)provideWebsitePreview(layout)
</script>

<template>
 <AdminCommonDataState v-if="layout&&canReadRules&&!rulesReady" :state="rulesError?'error':'loading'" :title="rulesError?'图片规则加载失败':'正在加载图片规则…'" :description="rulesError"><template v-if="rulesError" #action><UButton class="admin-button" @click="retryRules">重试</UButton></template></AdminCommonDataState>
 <WebsitePagePreview v-else-if="layout" :preview="layout" :data="{article}" />
 <PreviewSurface v-else :error="layoutError" />
</template>
