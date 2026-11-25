<!-- 默认布局：组合顶部导航、页面正文与页脚，合作入口由各页面按需展示。 -->
<script setup lang="ts">
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import CorporateHeader from './CorporateHeader.vue'
import BrandLoader from './BrandLoader.vue'
import {useBrandEntrance} from '~/composables/public/runtime/useBrandEntrance'
import {provideSceneGate} from '~/composables/public/runtime/useSceneGate'
import CustomCursor from './CustomCursor.vue'
const props=defineProps<{brandEntrance:boolean}>()
const {settings, ready} = useSiteSettings()
await ready
useHead(() => ({link: settings.value?.basic?.favicon ? [{rel: 'icon', href: settings.value.basic.favicon.src}] : []}))
useHead({noscript:[{innerHTML:'<style>.brand-loader{display:none!important}</style>'}]})
const route = useRoute()
const {pending,blocking,finish}=useBrandEntrance(props.brandEntrance)
provideSceneGate(pending)
watch(()=>route.fullPath,finish)
</script>

<template>
  <BrandLoader v-if="pending" />
  <div :inert="blocking">
  <CustomCursor />
  <!-- 跳过导航：为键盘用户提供直接进入正文的入口。 -->
  <a href="#main-content" class="skip-link">{{ $t('common.skip') }}</a>
  <CorporateHeader />
  <!-- 正文插槽：承载当前页面，并提供跳过导航的焦点目标。 -->
  <main id="main-content" tabindex="-1">
    <slot />
  </main>
  <!-- 内容模板声明自行放置页脚时，外壳不再重复展示。 -->
  <slot name="footer" />
  </div>
</template>
