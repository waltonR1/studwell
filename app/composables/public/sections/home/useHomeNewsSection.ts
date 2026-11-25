// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { useNewsPath } from '~/composables/public/sections/news/useNewsPath';
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
import { useHomeNews } from '~/composables/public/sections/news/useHomeNews';
export function useHomeNewsSection() {
  const { t: contentText, data } = usePublishedSection<{
    listingLink?: string;
  }>();
  const newsPath = useNewsPath(() => data.value.listingLink);
  const localePath = useLocalePath();
  const viewPending = (useHomeNews());
  return { pending: viewPending, resume(viewResolved: Awaited<typeof viewPending>) {
      const { available, featured, remaining } = viewResolved;
      return { contentText, data, newsPath, localePath, available, featured, remaining };
    } };
}
