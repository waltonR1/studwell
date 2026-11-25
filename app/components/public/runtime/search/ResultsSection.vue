<!-- 搜索结果：类型筛选、列表、状态与分页；检索和路由更新由父级处理。 -->
<script setup lang="ts">
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import { ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-vue-next'
import SearchPlaceholder from '~/components/public/runtime/search/SearchPlaceholder.vue'
import HighlightedText from '~/components/public/runtime/search/HighlightedText.vue'
import { SEARCH_TYPES, excerpt, type SearchFilter, type pageResults } from '~/utils/public/runtime/search/engine'
const props = defineProps<{ query: string; type: SearchFilter; error: string | null; status: 'loading' | 'ready' | 'failed'; listing: ReturnType<typeof pageResults>; announcement: string }>()
const emit = defineEmits<{ filter: [type: SearchFilter]; page: [page: number]; retry: [] }>()
const { t, locale, n } = useI18n(), localePath = useLocalePath()
const {settings}=useSiteSettings()
const newsEnabled=computed(()=>settings.value?.modules?.news!==false)
const noMatches = computed(() => props.status === 'ready' && !props.error && props.listing.counts.all === 0)
const visiblePages = computed(() => {
  const start = Math.max(1, Math.min(props.listing.page - 2, props.listing.pages - 4))
  return Array.from({ length: Math.min(5, props.listing.pages) }, (_, i) => start + i)
})
function date(value: string) { return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')) }
</script>
<template>
  <section class="search-results" :aria-busy="status === 'loading'">
    <nav v-if="!noMatches" class="search-filters" :aria-label="t('search.filterLabel')">
      <template v-for="option in SEARCH_TYPES" :key="option"><button v-if="option !== 'news' || newsEnabled" type="button" :aria-pressed="type === option" @click="emit('filter', option)">{{ t(`search.types.${option}`) }}<span v-if="status === 'ready' && !error">{{ n(listing.counts[option]) }}</span></button></template>
    </nav>
    <h2 v-if="!noMatches" class="result-heading">{{ announcement }}</h2>
    <div v-if="status === 'failed'" class="search-state"><p>{{ t('search.retryHint') }}</p><button type="button" class="text-action" @click="emit('retry')">{{ t('search.retry') }} <ArrowRight :size="18" aria-hidden="true" /></button></div>
    <div v-else-if="status === 'loading' && !error" class="loading-line" aria-hidden="true"></div>
    <template v-else-if="!error">
      <ol v-if="listing.items.length" class="result-list">
        <li v-for="result in listing.items" :key="result.id" class="search-result">
          <div class="result-meta"><span>{{ t(`search.types.${result.type}`) }}</span><span v-if="result.categoryPath.length">{{ result.categoryPath.join(' / ') }}</span><time v-if="result.publishedAt" :datetime="result.publishedAt">{{ date(result.publishedAt) }}</time></div>
          <h3><NuxtLink :to="localePath(result.path)"><span><HighlightedText :text="result.title" :query="query" /></span><ArrowUpRight :size="23" aria-hidden="true" /></NuxtLink></h3>
          <p><HighlightedText :text="excerpt(result, query)" :query="query" /></p>
        </li>
      </ol>
      <SearchPlaceholder v-else :message="t('search.emptyHint')" />
      <nav v-if="listing.pages > 1" class="search-pagination" :aria-label="t('search.pagination')">
        <button type="button" :disabled="listing.page === 1" :aria-label="t('search.previous')" @click="emit('page', listing.page - 1)"><ArrowLeft :size="18" aria-hidden="true" /></button>
        <button v-for="page in visiblePages" :key="page" type="button" :aria-label="t('search.goToPage', { page: n(page) })" :aria-current="page === listing.page ? 'page' : undefined" @click="emit('page', page)">{{ n(page) }}</button>
        <button type="button" :disabled="listing.page === listing.pages" :aria-label="t('search.next')" @click="emit('page', listing.page + 1)"><ArrowRight :size="18" aria-hidden="true" /></button>
        <span>{{ t('search.pageCount', { page: n(listing.page), count: n(listing.pages) }) }}</span>
      </nav>
    </template>
      </section>
</template>
<style scoped>
.search-results { margin-top: 36px; }
.search-filters { display: flex; flex-wrap: wrap; gap: 4px 28px; border-bottom: 1px solid #18283225; }
.search-filters button { display: flex; align-items: center; gap: 10px; min-height: 52px; padding-block: 12px; border-bottom: 2px solid transparent; color: var(--color-brand-muted); }
.search-filters button[aria-pressed="true"] { color: var(--color-brand-red); border-color: currentColor; }
.search-filters span { font: var(--text-label)/var(--leading-compact) var(--font-sans); }
.result-heading { margin-block: 28px 8px; font-size: var(--text-small); color: var(--color-brand-muted); overflow-wrap: anywhere; }
.result-list { list-style: none; padding: 0; margin: 0; }
.search-result { padding-block: 28px; border-bottom: 1px solid #18283225; }
.result-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: var(--text-label); color: var(--color-brand-muted); }
.result-meta > span:first-child { color: var(--color-brand-red); }
.search-result h3 { margin-block: 12px; font-size: var(--text-card); font-weight: var(--font-weight-semibold); line-height: var(--leading-heading); }
.search-result h3 a { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; overflow-wrap: anywhere; }
.search-result h3 svg { flex-shrink: 0; }
.search-result h3 a > span { min-width: 0; }
.search-result p { max-width: 860px; font-size: var(--text-body); color: var(--color-brand-muted); overflow-wrap: anywhere; }
.search-state { padding: 30px 0 48px; }
.search-state p { color: var(--color-brand-muted); }
.text-action { display: inline-flex; align-items: center; gap: 16px; min-height: 44px; color: var(--color-brand-red); }
.search-pagination { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 36px; }
.search-pagination button { display: grid; place-items: center; min-width: 44px; height: 44px; padding-inline: 8px; border: 1px solid #18283230; }
.search-pagination [aria-current] { color: white; background: var(--color-brand-red); border-color: var(--color-brand-red); }
.search-pagination > span { margin-left: auto; font-size: var(--text-label); color: var(--color-brand-muted); }
.loading-line { height: 2px; margin-block: 32px; background: var(--color-brand-red); opacity: .35; }
@media (hover: hover) { .search-result a:hover { color: var(--color-brand-red); } }
@media (max-width: 600px) {
  .search-filters { gap: 4px 20px; }
  .search-pagination > span { width: 100%; margin: 8px 0 0; }
}
</style>
