<script setup lang="ts">
import {usePublishedSection} from '~/composables/public/runtime/usePublicPage'
import {isExternalSiteLink} from '#shared/utils/website/site-link'
const {t:copy,data}=usePublishedSection<{items:Array<{title:string;body:string;order:number;featured:boolean;link:string|null}>}>()
const localePath=useLocalePath()
const items=computed(()=>[...(data.value.items??[])].sort((a,b)=>a.order-b.order))
const address=(value:string)=>isExternalSiteLink(value)||(value==='/admin'||value.startsWith('/admin/'))?value:localePath(value)
</script>
<template>
 <section class="guide-collection guide-article-frame">
  <h2>{{ copy('title') }}</h2><p class="guide-intro">{{ copy('intro') }}</p>
  <div class="guide-cards">
   <article v-for="(item,index) in items" :key="index" :class="{featured:item.featured}">
    <div class="card-meta"><span>{{ String(item.order).padStart(2,'0') }}</span><span v-if="item.featured">{{ copy('featured') }}</span></div>
    <h3>{{ item.title }}</h3><p>{{ item.body }}</p>
    <NuxtLink v-if="item.link" :to="address(item.link)" :external="isExternalSiteLink(item.link)">{{ copy('link') }} <span aria-hidden="true">↗</span></NuxtLink>
   </article>
  </div>
 </section>
</template>
<style scoped>
.guide-collection{padding-block:38px;scroll-margin-top:120px}.guide-collection h2{font-size:clamp(24px,3vw,34px);line-height:1.3;margin:0 0 14px}.guide-intro{color:#64748b;line-height:1.9;max-width:65ch}.guide-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:26px}.guide-cards article{background:#f6f8fc;border:1px solid #e1e8f2;border-radius:14px;padding:25px;display:flex;flex-direction:column;min-width:0}.guide-cards article.featured{background:#edf3ff;border-color:#b8cce9}.card-meta{display:flex;justify-content:space-between;gap:10px;color:#56749c;font-size:12px;letter-spacing:.06em}.guide-cards h3{font-size:20px;line-height:1.4;margin:21px 0 10px}.guide-cards p{font-size:15px;color:#66758b;line-height:1.85;margin:0 0 24px}.guide-cards a{margin-top:auto;color:#285d9e;text-decoration:none;font-size:14px;font-weight:600}.guide-cards a:focus-visible{outline:2px solid currentColor;outline-offset:5px}@media(max-width:1050px){.guide-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.guide-cards{grid-template-columns:1fr}.guide-cards article{padding:22px}}
</style>

