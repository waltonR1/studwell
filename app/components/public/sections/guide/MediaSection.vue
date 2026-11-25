<script setup lang="ts">
import SiteImage from '~/components/public/ui/SiteImage.vue'
import {usePublishedSection} from '~/composables/public/runtime/usePublicPage'
import type {DisplayImage} from '~/types/public/runtime/media'
const {t:copy,data}=usePublishedSection<{image:DisplayImage|null;poster:DisplayImage|null;video:string|null}>()
</script>
<template>
 <section class="guide-media guide-article-frame">
  <h2>{{ copy('title') }}</h2><p>{{ copy('intro') }}</p>
  <div class="media-pair">
   <figure><div class="media-frame"><SiteImage v-if="data.image" :image="data.image" :alt="copy('image')" width="1200" height="675" /></div><figcaption>{{ copy('image') }}</figcaption></figure>
   <figure><div class="media-frame"><video v-if="data.video" controls playsinline preload="metadata" :src="data.video" :poster="data.poster?.src" :aria-label="copy('video')" /></div><figcaption>{{ copy('video') }}</figcaption></figure>
  </div>
 </section>
</template>
<style scoped>
.guide-media{padding-block:35px;scroll-margin-top:120px}.guide-media h2{font-size:28px;line-height:1.4;margin:0 0 12px}.guide-media>p{color:#64748b;line-height:1.9}.media-pair{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}.media-pair figure{margin:0;min-width:0}.media-frame{aspect-ratio:16/9;border:1px solid #dce6f2;border-radius:12px;overflow:hidden;background:#edf3fc}.media-frame :deep(img),.media-frame video{width:100%;height:100%;object-fit:cover;display:block}.media-pair figcaption{color:#64748b;font-size:14px;line-height:1.7;margin-top:12px}@media(max-width:850px){.media-pair{grid-template-columns:1fr}}
</style>
