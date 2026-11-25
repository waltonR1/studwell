<script setup lang="ts">
import {usePublishedSection} from '~/composables/public/runtime/usePublicPage'
const {section}=usePublishedSection()
const content=computed(()=>{
 const fields=section.value?.content
 return {
  title:typeof fields?.title==='string'?fields.title:'',
  body:typeof fields?.body==='string'?fields.body:'',
  code:typeof fields?.code==='string'?fields.code:'',
 }
})
</script>
<template>
 <section class="document-section guide-article-frame"><div class="document-content"><h2>{{ content.title }}</h2><p v-for="paragraph in (content.body ?? '').split('\n').filter(Boolean)" :key="paragraph">{{ paragraph }}</p><pre v-if="content.code"><code>{{ content.code }}</code></pre></div></section>
</template>

<style scoped>
.document-section{margin:0 auto 38px;scroll-margin-top:120px}.document-section h2{font-size:21px;letter-spacing:-.4px;margin:0 0 16px;line-height:1.5}.document-section p{font-size:16px;line-height:2;color:#69758a;margin:10px 0}.document-section pre{border:1px solid #e3e9f3;background:#f7f9fd;border-radius:9px;padding:23px 25px;overflow:auto;color:#3d5c99;line-height:1.9;font-size:14px;margin-top:23px;white-space:pre-wrap;overflow-wrap:anywhere}.document-section code{font-family:Consolas,'Courier New',monospace}
</style>
