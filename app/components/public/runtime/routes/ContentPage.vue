<!-- 装配通用内容页，解析页面行为并渲染已发布区块。 -->
<script setup lang="ts">
import PublishedPageSections from '~/components/public/runtime/rendering/PublishedPageSections.vue'
import CorporateFooter from '~/components/public/runtime/layout/CorporateFooter.vue'
import {usePublicPage} from '~/composables/public/runtime/usePublicPage'
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import {usePublicSeo} from '~/composables/public/runtime/seo/usePublicSeo'
import {resolvePageBehavior,type PageBehavior} from '~/utils/public/runtime/pageBehaviors'

import {resolveRouteExtension,type RouteExtension} from '~/utils/public/runtime/routeTemplates'

const {pageKey,targetType='page',targetKey='',detailTemplates=[],sectionBehaviors=[],observeScenes=false} = defineProps<{pageKey?:string;targetType?:string;targetKey?:string;detailTemplates?:readonly RouteExtension[];sectionBehaviors?:readonly PageBehavior[];observeScenes?:boolean}>()
// 发布页面读取正常快照；搜索等代码页面通过默认插槽提供正文，共用页脚装配。
const published = pageKey?usePublicPage(pageKey):undefined
const extension=published?resolveRouteExtension(detailTemplates,targetType)?.setup(targetKey):undefined
await Promise.all([published?.ready,extension?.ready])
const localePath=useLocalePath()
const route=useRoute()
const {settings}=useSiteSettings()
const redirect=published&&pageKey?resolvePageBehavior(sectionBehaviors,published.sections.value,pageKey,settings.value?.pages??{}):undefined
if(redirect?.external)await navigateTo(redirect.to,{external:true,redirectCode:301})
else if(redirect)await navigateTo({path:localePath(redirect.to.path),query:{...route.query,...redirect.to.query},hash:redirect.to.hash||route.hash},{redirectCode:301})
if(published)usePublicSeo(()=>extension?extension.seo():published.snapshot.value?.structure.seo)
const hasScenes=computed(()=>!!published&&(observeScenes||published.snapshot.value?.structure.sceneEnabled===true))
</script>

<template>
  <div v-if="!published||published.snapshot.value" class="content-page" :class="[extension?.pageClass,{'has-scenes':hasScenes}]" :key="published?.snapshot.value?.page.locale + ':' + published?.snapshot.value?.page.releaseId">
    <PublishedPageSections v-if="published?.snapshot.value" :structure="published.snapshot.value.structure" :sections="published.sections.value" :observe-scenes="observeScenes">
      <template #footer><slot name="footer"><CorporateFooter /></slot></template>
    </PublishedPageSections>
    <template v-else><slot /><slot name="footer"><CorporateFooter /></slot></template>
  </div>
</template>

<style scoped>
/* 场景容器自行处理页头避让，包括固定分场退回自然滚动的情况。 */
.content-page.has-scenes { padding-top:0; }
</style>
