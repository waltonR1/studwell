// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { useBrandIdentity } from '~/composables/public/runtime/useBrandIdentity';
import { useSiteSettings } from '~/composables/public/runtime/useSiteSettings';
import { isExternalSiteLink } from '#shared/utils/website/site-link';
import type { PublicLinkTarget, PublicSiteSettings } from '#shared/types/public/website';
import { siteLink } from '~/utils/public/runtime/siteLink';
export function useCorporateFooter() {
  const brandName = useBrandIdentity();
  const { settings, ready } = useSiteSettings();
  const viewPending = (ready);
  return { pending: viewPending, resume(viewResolved: Awaited<typeof viewPending>) {
      void viewResolved;
      const footer = computed(() => settings.value?.footer);
      const localePath = useLocalePath();
      const contactHref = (contact: {
        kind: string;
        value: string;
      }) => contact.kind === 'email' ? 'mailto:' + contact.value : contact.kind === 'phone' ? 'tel:' + contact.value.replace(/[^+0-9]/g, '') : undefined;
      function localizedLink(target: PublicLinkTarget, value: PublicSiteSettings) {
        const { address, path, query, hash } = siteLink(target, value);
        return address ? (isExternalSiteLink(address) ? address : localePath(address)) : path ? localePath({ path, query, hash }) : undefined;
      }
      const groups = computed(() => {
        const value = settings.value;
        return value?.footer?.groups.map(group => ({ ...group, items: group.items.map(item => ({ ...item, to: localizedLink(item.target, value) })).filter(item => item.to) })) ?? [];
      });
      const contactLink = computed(() => footer.value?.contactTarget && settings.value ? localizedLink(footer.value.contactTarget, settings.value) : null);
      return { brandName, settings, footer, localePath, contactHref, groups, contactLink };
    } };
}
