// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { isExternalSiteLink } from '#shared/utils/website/site-link';
import { publicImage } from '~/utils/public/runtime/pageMedia';
import type { PublicImageReference } from '#shared/types/public/website';
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
export function useCommonLinkCards() {
  const { t: contentText, section, snapshot } = usePublishedSection();
  const localePath = useLocalePath();
  const cards = computed(() => {
    const page = snapshot.value;
    const data = section.value?.content.data as {
      cards?: Array<{
        id: string;
        name: string;
        summary: string;
        status: string;
        image: PublicImageReference;
        resourceId: string;
      }>;
    } | undefined;
    if (!page)
      return [];
    return (data?.cards ?? []).flatMap(card => {
      const address = card.resourceId;
      const to = address ? (isExternalSiteLink(address) ? address : localePath(address)) : '';
      const image = publicImage(card.image, page.page.media, card.name);
      return to && image ? [{ ...card, to, image }] : [];
    });
  });
  return { contentText, section, cards };
}
