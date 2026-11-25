<script setup lang="ts">
import PreviewSurface from './PreviewSurface.vue'
import {providePreviewData} from '~/composables/admin/preview/providePreviewData'
import type {WebsitePreviewData,WebsitePagePreviewView} from '#shared/types/admin/website-preview'

import {usePublicPage} from '~/composables/public/runtime/usePublicPage'
import PublishedPageSections from '~/components/public/runtime/rendering/PublishedPageSections.vue'

const {preview,data} = defineProps<{preview: WebsitePagePreviewView;data?:WebsitePreviewData}>()
providePreviewData(()=>({...preview.previewData,...data}),preview.previewSettings)
const {structure} = preview
const {sections} = usePublicPage(structure.key)
</script>

<template>
  <PreviewSurface class="draft-preview">
    <p v-if="!sections.length" class="container-shell">当前版本没有可见区块。</p>
    <PublishedPageSections v-else :structure="structure" :sections="sections" :header-height="0" />
  </PreviewSurface>
</template>

<style scoped>
.draft-preview { --header-height: 0px; padding-top: 0; min-height: 100vh; }
</style>
