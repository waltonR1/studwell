<script setup lang="ts">
import type {Component} from 'vue'
import type {WebsitePageView} from '#shared/types/public/website'
import {usePublicPage} from '~/composables/public/runtime/usePublicPage'
import PublishedSection from '~/components/public/runtime/rendering/PublishedSection.vue'

const {sample,component}=defineProps<{sample:WebsitePageView;component:Component}>()
const {sections}=usePublicPage(sample.page.key)
</script>

<template>
 <PublishedSection v-if="sections[0]" :id="sections[0].id"><component :is="component" /></PublishedSection>
</template>
