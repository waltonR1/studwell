// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
type SectionContent = {
  details: {
    address: string;
    companyName: string;
  };
  channels: {
    contactChannels: {
      fax: string;
      hotlines: Array<{
        href: string;
        number: string;
        language: string;
      }>;
      exportEmail: string;
      investmentEmail: string;
    };
  };
};
export function useContactContactDetails() {
  const { t: contentText, data } = usePublishedSection<SectionContent>();
  const details = computed(() => data.value.details);
  const contactChannels = computed(() => data.value.channels.contactChannels);
  return { contentText, details, contactChannels };
}
