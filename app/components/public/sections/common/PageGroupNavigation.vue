<script setup lang="ts">
import {useCommonPageGroupNavigation} from '~/composables/public/sections/common/useCommonPageGroupNavigation'
const {links}=useCommonPageGroupNavigation()
</script>
<template>
 <nav class="guide-related guide-article-frame">
  <NuxtLink v-for="link in links" :key="link.key" :to="link.path" :aria-current="link.active?'page':undefined">{{ link.label }}</NuxtLink>
 </nav>
</template>
<style scoped>
.guide-related{display:flex;gap:10px;flex-wrap:wrap;padding-block:24px;margin-block:20px}.guide-related a{border:1px solid #dce6f2;border-radius:8px;padding:11px 18px;color:#46648c;text-decoration:none;font-size:14px;line-height:1.6}.guide-related a[aria-current=page]{background:#204f88;border-color:#204f88;color:white}.guide-related a:focus-visible{outline:2px solid #204f88;outline-offset:3px}
</style>
