// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { useBrandIdentity } from '~/composables/public/runtime/useBrandIdentity';
import { useSiteSettings } from '~/composables/public/runtime/useSiteSettings';
import { isExternalSiteLink } from '#shared/utils/website/site-link';
import { siteLink } from '~/utils/public/runtime/siteLink';
type NavigationKey = string;
type SectionLink = {
  path: string;
  hash?: string;
  query?: Record<string, string>;
  address?: string;
};
export function useCorporateHeader() {
  const brandName = useBrandIdentity();
  const { t } = useI18n();
  const localePath = useLocalePath();
  const route = useRoute();
  const { settings, ready } = useSiteSettings();
  const viewPending = (ready);
  return { pending: viewPending, resume(viewResolved: Awaited<typeof viewPending>) {
      void viewResolved;
      function localizedLink({ address, path, hash, query }: SectionLink) {
        return address ? (isExternalSiteLink(address) ? address : localePath(address)) : localePath({ path, hash, query });
      }
      const navigation = computed(() => {
        const value = settings.value;
        return value?.header?.items.map(item => ({
          key: item.id, label: item.label, ...siteLink(item.target, value),
          children: item.children.map(child => ({ label: child.label, ...siteLink(child.target, value) })).filter(child => child.address || child.path),
        })).filter(item => item.address || item.path) ?? [];
      });
      const open = ref(false);
      const desktopSection = ref<NavigationKey>();
      const mobileSection = ref<NavigationKey>();
      function closePanels() {
        open.value = false;
        desktopSection.value = undefined;
        mobileSection.value = undefined;
      }
      function toggleDesktop(key: NavigationKey) {
        desktopSection.value = desktopSection.value === key ? undefined : key;
      }
      function isSectionActive(key: NavigationKey) {
        const item = navigation.value.find(item => item.key === key);
        if (!item || item.address)
          return false;
        const path = localePath(item.path);
        return route.path === path || (path !== localePath('/') && route.path.startsWith(path + '/'));
      }
      function isChildActive(link: SectionLink) {
        if (link.address)
          return false;
        const path = localePath(link.path);
        if (route.path !== path)
          return false;
        if (link.query)
          return Object.entries(link.query).every(([key, value]) => route.query[key] === value);
        return !link.hash || route.hash === link.hash;
      }
      function onBreakpoint() { closePanels(); }
      watch(() => route.fullPath, closePanels);
      return { brandName, t, localePath, settings, localizedLink, navigation, open, desktopSection, mobileSection, closePanels, toggleDesktop, isSectionActive, isChildActive, onBreakpoint };
    } };
}
