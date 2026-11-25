<script setup lang="ts">
import {usePublishedSection} from '~/composables/public/runtime/usePublicPage'
const {section}=usePublishedSection()
const content=computed(()=>section.value?.content)
const facts=computed(()=>Array.isArray(content.value?.facts)?content.value.facts as Array<{value:string;label:string}>:[])
</script>
<template>
 <section class="guide-intro guide-article-frame">
  <header><p class="article-kicker">{{ content?.eyebrow }}</p><h1>{{ content?.heading }}</h1><p class="article-summary">{{ content?.summary }}</p><dl v-if="facts.length" class="intro-facts"><div v-for="fact in facts" :key="fact.label"><dt>{{ fact.label }}</dt><dd>{{ fact.value }}</dd></div></dl><div class="article-divider"/></header>
 </section>
</template>
<style scoped>
.guide-intro{padding-top:69px}
.article-kicker{font-size:11px;letter-spacing:2.5px;font-weight:650;color:#365ddd;margin:0 0 25px}
h1{font-size:clamp(2rem,3.05vw,3.15rem);line-height:1.35;letter-spacing:-1.8px;margin:0;font-weight:700;max-width:760px}
.article-summary{font-size:17px;line-height:1.95;color:#798498;margin:23px 0 0;max-width:680px}
.intro-facts{margin:34px 0 0;display:flex;gap:34px}.intro-facts>div{display:flex;flex-direction:column-reverse;gap:8px}.intro-facts dt{font-size:12px;color:#8691a4}.intro-facts dd{margin:0;font-size:25px;color:#294b99;font-weight:600;font-variant-numeric:tabular-nums}
.article-divider{height:1px;background:#e9edf3;margin:39px 0}
@media(min-width:1700px){.guide-intro{padding-top:85px}}
@media(max-width:1250px){.guide-intro{padding-top:55px;}h1{font-size:2.5rem}}
@media(max-width:760px){.guide-intro{padding-top:43px}h1{font-size:2rem;letter-spacing:-1px}.article-summary{font-size:16px}.intro-facts{gap:26px}.article-kicker{font-size:10px;letter-spacing:1.5px}}
</style>
