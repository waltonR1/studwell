// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
import { useSiteSettings } from '~/composables/public/runtime/useSiteSettings';
export function useCommonPageEntry() {
  const { data, pageLabel } = usePublishedSection<{
    targetResourceId: string;
  }>();
  const { settings } = useSiteSettings(), localePath = useLocalePath();
  const target = computed(() => Object.values(settings.value?.pages ?? {}).find(page => page.path === data.value.targetResourceId));
  const destination = computed(() => data.value.targetResourceId ? (/^https?:\/\//i.test(data.value.targetResourceId) ? data.value.targetResourceId : localePath(data.value.targetResourceId)) : '');
  return { pageLabel, target, destination };
}
