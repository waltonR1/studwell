// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
import { useCareerPositions } from '~/composables/public/sections/careers/useCareerPositions';
export function useCareersPositionsSection() {
  const { t: contentText } = usePublishedSection();
  const { t } = useI18n();
  const viewPending = (useCareerPositions());
  return { pending: viewPending, resume(viewResolved: Awaited<typeof viewPending>) {
      const { positions, available, error, pending } = viewResolved;
      const statusText = computed(() => [t('careers.status.loading'), t('careers.status.error')]);
      return { contentText, positions, available, error, pending, statusText };
    } };
}
