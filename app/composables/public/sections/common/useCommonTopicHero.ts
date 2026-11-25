// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import type { ColumnHeroData } from '~/types/public/sections/shared/hero';
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
import { usePageBreadcrumbs } from '~/composables/public/runtime/usePageBreadcrumbs';
export function useCommonTopicHero() {
  const { t: contentText, data, snapshot } = usePublishedSection<ColumnHeroData>();
  const page = computed(() => data.value.topics[0]);
  const video = computed<{
    src: string;
  } | undefined>(() => 'heroVideo' in data.value && typeof data.value.heroVideo === 'string' ? { src: data.value.heroVideo } : undefined);
  const structure = computed(() => snapshot.value?.structure);
  const title = computed(() => contentText('title'));
  const breadcrumbItems = usePageBreadcrumbs(structure, title);
  return { contentText, page, video, structure, title, breadcrumbItems };
}
