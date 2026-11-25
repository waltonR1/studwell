<!-- 布局品牌标识：使用预生成透明图和多倍率资源，避免 Safari 运行时缩放位图。 -->
<script setup lang="ts">
import {useBrandIdentity} from '~/composables/public/runtime/useBrandIdentity'
const brandName=useBrandIdentity()
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import SiteImage from '~/components/public/ui/SiteImage.vue'
const {settings} = useSiteSettings()
</script>
<template>
  <SiteImage v-if="settings?.basic?.logo" :image="{...settings.basic.logo,alt:brandName}" fetchpriority="high" class="brand-logo"/>
</template>

<style scoped>
/* 原色透明Logo适配浅色布局；不再依赖反色或混合模式。 */
.brand-logo {
  display: block;
  width: var(--brand-logo-width, 132px);
  height: auto;
  object-fit: contain;
}
</style>
