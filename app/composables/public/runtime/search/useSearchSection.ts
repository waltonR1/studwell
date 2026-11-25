// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { useSearch } from '~/composables/public/runtime/search/useSearch';
export function useSearchSection() {
  const { t, n } = useI18n();
  const { state, draft, error, status, listing, submit, clear, retry, filter, turnPage } = useSearch();
  const announcement = computed(() => !state.value.q ? '' : error.value ? t('search.' + error.value) : status.value === 'loading' ? t('search.loading') : status.value === 'failed' ? t('search.failed') : t('search.resultCount', { query: state.value.q, count: n(listing.value.total) }));
  return { t, state, draft, error, status, listing, submit, clear, retry, filter, turnPage, announcement };
}
