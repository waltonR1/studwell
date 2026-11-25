<script setup lang="ts">
import {notifyPreviewFrame} from '~/utils/admin/preview/frame-state'
import {articlePreviewPayload} from '~/utils/admin/preview/article-payload'
import {siteLocales} from '#shared/schemas/admin/site-settings'
import {emptyNewsContent} from '#shared/schemas/admin/news'
import ArticlePreview from '~/components/admin/news/ArticlePreview.vue'

definePageMeta({layout:false,admin:true,middleware:'admin',adminPermission:'content.news.read'})
defineI18nRoute(false)
useHead({title:'新闻文章预览',meta:[{name:'robots',content:'noindex,nofollow'}]})
const {locale,loadLocaleMessages}=useI18n()
const error=ref(false)
let requestVersion=0
const preview=shallowRef<{content:ReturnType<typeof emptyNewsContent>;locale:typeof siteLocales[number]}>()
async function receive(event:MessageEvent){
 if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='website-article-preview')return
 const version=++requestVersion
 const result=articlePreviewPayload.safeParse(event.data.article)
 if(!result.success){error.value=true;notifyPreviewFrame('failed');return}
 error.value=false
 const {content,locale:language}=result.data
 try{await loadLocaleMessages(language)}catch{if(version===requestVersion){error.value=true;notifyPreviewFrame('failed')}return}
 if(version!==requestVersion)return
 locale.value=language
 for(const entry of Object.values(content.localized))if(!/^https?:\/\//i.test(entry.sourceUrl))entry.sourceUrl=''
 preview.value={content,locale:language}
}
onMounted(()=>{
 if(window.parent===window)return
 window.addEventListener('message',receive)
 window.parent.postMessage({type:'website-article-preview-ready'},location.origin)
})
onBeforeUnmount(()=>{requestVersion++;window.removeEventListener('message',receive)})
</script>

<template>
 <ArticlePreview v-if="preview" :key="preview.locale" :content="preview.content" :locale="preview.locale" />
 <p v-else class="container-shell" role="status">{{ error ? '文章预览数据无法读取，请关闭后重试。' : '等待新闻预览内容。' }}</p>
</template>
