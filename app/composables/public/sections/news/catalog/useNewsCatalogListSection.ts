// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { useNewsPath } from '~/composables/public/sections/news/useNewsPath';
import { useNewsCatalog } from '~/composables/public/sections/news/useNewsCatalog';
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
interface NewsListContent {
  pageSize: number;
  showFilters: boolean;
  showDate: boolean;
  showSummary: boolean;
}
export function useNewsCatalogListSection() {
  const newsPath = useNewsPath();
  const { t } = useI18n();
  const route = useRoute();
  const localePath = useLocalePath();
  const { t: contentText, data } = usePublishedSection<NewsListContent>();
  const viewPending = (useNewsCatalog(() => data.value.pageSize));
  return { pending: viewPending, resume(viewResolved: Awaited<typeof viewPending>) {
      const { list, error, pending, selectedCategory, page } = viewResolved;
      const notFound = computed(() => error.value?.statusCode === 404);
      if (error.value && !notFound.value)
        throw createError(error.value);
      const lastPage = computed(() => Math.min(100000, Math.ceil((list.value?.total ?? 0) / (list.value?.pageSize ?? 1))));
      function filterLocation(category?: string, nextPage = 1) {
        const { category: _category, page: _page, ...query } = route.query;
        return localePath({ path: newsPath(), query: { ...query, ...(category ? { category } : {}), ...(nextPage > 1 ? { page: String(nextPage) } : {}) }, hash: '#news-list' });
      }
      return { t, contentText, data, list, error, pending, selectedCategory, page, notFound, lastPage, filterLocation };
    } };
}
