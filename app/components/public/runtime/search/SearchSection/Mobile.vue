<!-- 手机端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import SearchForm from '~/components/public/runtime/search/SearchForm.vue';
import ResultsSection from '~/components/public/runtime/search/ResultsSection.vue';
import SearchPlaceholder from '~/components/public/runtime/search/SearchPlaceholder.vue';
import { useSearchSection } from '~/composables/public/runtime/search/useSearchSection';
const { t, state, draft, error, status, listing, submit, clear, retry, filter, turnPage, announcement } = useSearchSection();
</script>
<template>
  <SearchForm v-model="draft" :submitted-query="state.q" :error="error" @submit="submit()" @clear="clear" />
  <p v-if="!state.q" class="search-hint">{{ t('search.hint') }}</p>
  <p class="search-sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
  <SearchPlaceholder v-if="!state.q" />
  <ResultsSection v-if="state.q" :query="state.q" :type="state.type" :error="error" :status="status" :listing="listing" :announcement="announcement" @filter="filter" @page="turnPage" @retry="retry" />
</template>
<style scoped>
.search-hint { margin-top: 12px; color: var(--color-brand-muted); font-size: var(--text-small); }
</style>
