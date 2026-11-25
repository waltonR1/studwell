<!-- 搜索共用占位：未搜索与无结果状态复用图标、布局，按状态显示提示。 -->
<script setup lang="ts">
import { Search } from 'lucide-vue-next'
defineProps<{ message?: string }>()
const { t } = useI18n()
</script>

<template>
  <div class="search-initial">
    <span class="search-initial-icon" aria-hidden="true"><Search :size="38" :stroke-width="1.25" /></span>
    <p>{{ message || t('search.initialPrompt') }}</p>
  </div>
</template>

<style scoped>
.search-initial { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; min-height: 180px; margin-top: 32px; padding: 24px; text-align: center; border-top: 1px solid var(--rule); }
.search-initial-icon { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; background: #18283205; color: #18283250; }
.search-initial p { color: var(--color-brand-muted); font-size: var(--text-small); line-height: var(--leading-body); }
@media (max-width: 767px) { .search-initial { min-height: 160px; margin-top: 24px; } }
</style>
