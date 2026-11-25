<!-- 装配当前站点外壳；首页启用品牌入场，页脚由 ContentPage 装配。 -->
<script setup lang="ts">
import CorporateShell from '~/components/public/runtime/layout/CorporateShell.vue'

const route=useRoute()
const isHome=computed(()=>route.meta.siteHome===true)
</script>

<template>
  <CorporateShell :brand-entrance="isHome">
    <slot />
  </CorporateShell>
</template>
