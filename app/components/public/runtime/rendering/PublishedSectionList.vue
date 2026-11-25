<!-- 按发布顺序加载区块组件，并传入各区块的页面锚点。 -->
<script setup lang="ts">
import type {PublicSection} from '#shared/types/public/website'
import PublishedSection from './PublishedSection.vue'
import {resolveSectionRenderer} from '~/utils/public/runtime/sectionRenderer'

defineProps<{
  sections: PublicSection[]
}>()
</script>

<template>
  <PublishedSection v-for="section in sections" :id="section.id" :key="section.id">
    <component :is="resolveSectionRenderer(section.renderer)" :id="section.anchorKey" />
  </PublishedSection>
</template>
