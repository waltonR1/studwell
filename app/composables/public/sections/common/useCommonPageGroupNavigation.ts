// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
import { pageNavigation } from '~/utils/public/sections/common/pageNavigation';
import { isExternalSiteLink } from '#shared/utils/website/site-link';
export function useCommonPageGroupNavigation() {
  const { data, snapshot } = usePublishedSection<{
    links: Array<{
      resourceId: string;
      label: string;
    }>;
  }>();
  const localePath = useLocalePath(), route = useRoute();
  const { t, locale } = useI18n();
  const links = computed(() => pageNavigation(data.value.links ?? [], { path: snapshot.value?.structure.path ?? '', query: route.query, hash: route.hash }).map(link => ({ ...link, path: isExternalSiteLink(link.address) ? link.address : localePath(link.address) })));
  const active = computed(() => links.value.find(link => link.active)?.key);
  return { snapshot, t, links, active, locale };
}
