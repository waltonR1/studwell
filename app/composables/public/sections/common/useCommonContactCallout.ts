// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
export function useCommonContactCallout() {
  const { t: contentText, data } = usePublishedSection<{
    targetPath: string;
  }>();
  const to = computed(() => data.value.targetPath ?? '');
  const localePath = useLocalePath();
  return { contentText, to, localePath };
}
