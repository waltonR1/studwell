<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import HoverLabel from '~/components/public/runtime/layout/HoverLabel.vue';
import BrandLogo from '~/components/public/runtime/layout/BrandLogo.vue';
import { ArrowUpRight, ChevronDown, Search } from 'lucide-vue-next';
import { useBodyScrollLock } from '~/composables/public/runtime/useBodyScrollLock';
import LanguageSwitcher from '~/components/public/runtime/layout/LanguageSwitcher.vue';
import { useCorporateHeader } from '~/composables/public/runtime/layout/useCorporateHeader';
type NavigationKey = string;
const viewSetup = useCorporateHeader();
const viewResolved = await viewSetup.pending;
const { brandName, t, localePath, settings, localizedLink, navigation, open, desktopSection, mobileSection, closePanels, toggleDesktop, isSectionActive, isChildActive, onBreakpoint } = viewSetup.resume(viewResolved);
const menuButton = ref<HTMLButtonElement>();
const header = ref<HTMLElement>();
let desktop: MediaQueryList | undefined;
function enterItem(event: PointerEvent, key?: NavigationKey) {
  if (event.pointerType === 'mouse')
    desktopSection.value = key;
}
function leaveItem(event: PointerEvent) {
  if (!(event.currentTarget as HTMLElement).contains(document.activeElement))
    desktopSection.value = undefined;
}
function leaveFocus(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    desktopSection.value = undefined;
}
function outsidePointer(event: PointerEvent) {
  if (!header.value?.contains(event.target as Node))
    desktopSection.value = undefined;
}
async function onItemKey(event: KeyboardEvent, key: NavigationKey) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
    return;
  const item = event.currentTarget as HTMLElement;
  const inDropdown = Boolean((event.target as HTMLElement).closest('.desktop-submenu'));
  if (!inDropdown && (event.key === 'Home' || event.key === 'End'))
    return;
  event.preventDefault();
  desktopSection.value = key;
  await nextTick();
  const links = Array.from(item.querySelectorAll<HTMLAnchorElement>('.desktop-submenu a'));
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : current < 0 ? (event.key === 'ArrowUp' ? links.length - 1 : 0) : (current + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
  links[index]?.focus();
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (open.value) {
      event.preventDefault();
      closeMobile();
    }
    else if (desktopSection.value) {
      event.preventDefault();
      const key = desktopSection.value;
      desktopSection.value = undefined;
      header.value?.querySelector<HTMLButtonElement>(`[data-nav-toggle="${key}"]`)?.focus();
    }
  }
  if (event.key !== 'Tab' || !open.value)
    return;
  const nodes = header.value?.querySelectorAll<HTMLElement>('a[href], button');
  const visible = Array.from(nodes || []).filter(element => element.getClientRects().length);
  const first = visible[0], last = visible[visible.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
useBodyScrollLock(open);
onMounted(() => {
  desktop = window.matchMedia('(min-width: 1440px)');
  desktop.addEventListener('change', onBreakpoint);
  document.addEventListener('pointerdown', outsidePointer);
});
onBeforeUnmount(() => {
  desktop?.removeEventListener('change', onBreakpoint);
  document.removeEventListener('pointerdown', outsidePointer);
});
function closeMobile() {
  closePanels();
  menuButton.value?.focus();
}
</script>
<template>
  <header v-if="settings?.header" ref="header" class="site-header" @keydown="onKey">
    <div class="header-inner">
      <NuxtLink :to="localePath('/')" class="brand" :aria-label="brandName" @click="closePanels"><BrandLogo /></NuxtLink>
      <nav class="desktop-nav" :aria-label="t('common.navigation')">
        <div v-for="item in navigation" :key="item.key" class="nav-item" @pointerleave="leaveItem" @focusout="leaveFocus" @keydown="item.children.length && onItemKey($event, item.key)">
          <div class="nav-entry" :class="{ active: isSectionActive(item.key), expanded: desktopSection === item.key, 'nav-entry-leaf': !item.children.length }">
            <NuxtLink :to="localizedLink(item)" class="nav-page" @pointerenter="enterItem($event, item.children.length ? item.key : undefined)" @click="closePanels()"><HoverLabel :text="item.label" /></NuxtLink>
            <button v-if="item.children.length" type="button" class="submenu-toggle" :data-nav-toggle="item.key" :aria-label="`${item.label} · ${t('common.menu')}`" :aria-expanded="desktopSection === item.key" :aria-controls="`desktop-submenu-${item.key}`" @click="toggleDesktop(item.key)"><ChevronDown :size="13" aria-hidden="true" /></button>
          </div>
          <ul v-if="item.children.length" v-show="desktopSection === item.key" :id="`desktop-submenu-${item.key}`" class="desktop-submenu" :aria-label="item.label">
            <li v-for="child in item.children" :key="child.label"><NuxtLink :to="localizedLink(child)" :class="{ current: isChildActive(child) }" :aria-current="isChildActive(child) ? (child.hash ? 'location' : 'page') : undefined" @click="closePanels()"><span>{{ child.label }}</span><ArrowUpRight :size="15" aria-hidden="true" /></NuxtLink></li>
          </ul>
        </div>
      </nav>
      <NuxtLink :to="localePath('/search')" class="header-search" :aria-label="t('search.title')" @click="closePanels"><Search :size="21" aria-hidden="true" /></NuxtLink>
      <LanguageSwitcher @open="closePanels" />
      <button ref="menuButton" type="button" class="menu-toggle" :aria-label="open ? t('common.close') : t('common.menu')" :aria-expanded="open" aria-controls="mobile-menu" @click="open = !open">
        <span>{{ t(open ? 'common.closeLabel' : 'common.menuLabel') }}</span><span class="menu-circle"><span class="menu-lines" aria-hidden="true"></span></span>
      </button>
    </div>
      <div v-if="open" id="mobile-menu" class="mobile-menu" :inert="!open">
        <div class="menu-intro"><p class="eyebrow">{{ brandName }} / {{ t('common.navigation') }}</p><p>{{ settings.header.tagline }}</p></div>
        <nav class="mobile-navigation" :aria-label="t('common.navigation')">
          <NuxtLink :to="localePath('/')" class="mobile-home" @click="closePanels"><span class="menu-number">00</span>{{ t('nav.home') }}<ArrowUpRight :size="24" aria-hidden="true" /></NuxtLink>
          <div v-for="(item, index) in navigation" :key="item.key" class="mobile-group">
            <div class="mobile-row" :class="{ active: isSectionActive(item.key) }">
              <NuxtLink :to="localizedLink(item)" @click="closePanels()"><span class="menu-number">0{{ index + 1 }}</span>{{ item.label }}</NuxtLink>
              <button v-if="item.children.length" type="button" :aria-label="`${item.label} · ${t('common.menu')}`" :aria-expanded="mobileSection === item.key" :aria-controls="`mobile-submenu-${item.key}`" @click="mobileSection = mobileSection === item.key ? undefined : item.key"><ChevronDown :size="20" aria-hidden="true" /></button>
            </div>
            <ul v-if="item.children.length" v-show="mobileSection === item.key" :id="`mobile-submenu-${item.key}`" class="mobile-submenu" :aria-label="item.label"><li v-for="child in item.children" :key="child.label"><NuxtLink :to="localizedLink(child)" :class="{ current: isChildActive(child) }" :aria-current="isChildActive(child) ? (child.hash ? 'location' : 'page') : undefined" @click="closePanels()">{{ child.label }}<ArrowUpRight :size="16" aria-hidden="true" /></NuxtLink></li></ul>
          </div>
        </nav>
      </div>
  </header>
</template>
<style scoped>
.site-header {
  --header-bg: #a9162a;
  --header-fg: #fff;
  --header-accent: #fff;
  --header-focus: #fff;
  --header-hover-bg: #ffffff14;
  --rule-dark: #ffffff38;
  position:fixed;
  z-index:50;
  top:0;
  width:100%;
  color:var(--header-fg);
  background:var(--header-bg);
}
.header-inner { position:relative; width:min(calc(100% - var(--page-gutter) * 2),var(--content-width)); margin-inline:auto; display:flex; align-items:center; min-height:var(--header-height); gap:20px; border-bottom:1px solid var(--rule-dark); }
.brand { flex-shrink:0; display:flex; align-items:center; align-self:stretch; padding-inline:8px; }
.brand :deep(.brand-logo) { --image-extra-filter:brightness(0) invert(1); }
.desktop-nav { display:none; }
.header-search { display:grid; place-items:center; width:44px; min-height:44px; flex:none; margin-left:auto; transition:background-color 200ms ease,color 200ms ease; }
.header-search:hover,.header-search.router-link-active,.header-search:focus-visible { color:var(--header-fg); background:var(--header-hover-bg); }
.header-inner :deep(.header-language) { margin-left:0; }
.menu-toggle { margin:0; padding:0; display:flex; flex:none; align-items:center; gap:12px; border:0; background:transparent; color:var(--header-fg); font-size:var(--text-small); cursor:pointer; -webkit-tap-highlight-color:transparent; }
.menu-circle { box-sizing:border-box; width:44px; height:44px; display:grid; place-items:center; border:1px solid #ffffff66; transition:background-color .2s,border-color .2s,color .2s,transform .2s; }
.menu-lines { position:relative; width:20px; height:16px; transition:transform .22s; }
.menu-lines::before,.menu-lines::after { content:''; position:absolute; left:0; top:7px; width:20px; height:2px; background:currentColor; transform-origin:center; transition:transform .22s; }
.menu-lines::before { transform:translateY(-4px); }.menu-lines::after { transform:translateY(4px); }
.menu-toggle[aria-expanded="true"] .menu-lines::before { transform:rotate(45deg); }.menu-toggle[aria-expanded="true"] .menu-lines::after { transform:rotate(-45deg); }
.menu-toggle[aria-expanded="true"] .menu-circle { background:white; border-color:white; color:var(--color-brand-red); }
.menu-toggle:active .menu-circle { transform:scale(.94); }
.menu-toggle:focus-visible .menu-circle { border-color:white; }
.mobile-menu { --header-focus:var(--color-brand-red); --rule-dark:#18283220; height:calc(100dvh - var(--header-height)); overflow-y:auto; padding:24px var(--page-gutter) 40px; background:#f4f5f2; color:var(--color-brand-text); overscroll-behavior:contain; }
.menu-intro { margin-bottom:20px; }.menu-intro p:last-child { display:none; }
.mobile-navigation { display:grid; }
.mobile-home,.mobile-row { display:flex; align-items:center; border-bottom:1px solid var(--rule-dark); }
.mobile-home,.mobile-row > a { display:flex; align-items:center; gap:16px; padding:17px 12px; font-size:var(--text-card); line-height:var(--leading-heading); min-width:0; }
.mobile-home svg { margin-left:auto; flex-shrink:0; }.mobile-row > a { flex:1; }
.menu-number { font-family:var(--font-sans); width:28px; flex-shrink:0; font-size:var(--text-label); color:var(--color-brand-muted); }
.mobile-row > button { display:grid; place-items:center; min-width:48px; min-height:48px; background:transparent; border:0; color:inherit; flex-shrink:0; }
.mobile-row > button svg,.submenu-toggle svg { transition:transform .2s; }
button[aria-expanded="true"] > svg { transform:rotate(180deg); }
.mobile-row.active { color:var(--color-brand-red); background:#b319240a; box-shadow:inset 3px 0 var(--color-brand-red); }
.mobile-submenu { list-style:none; padding:6px 12px 16px 56px; border-bottom:1px solid var(--rule-dark); }
.mobile-submenu a { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:13px 0; font-size:var(--text-body); line-height:var(--leading-body); overflow-wrap:normal; word-break:normal; hyphens:none; }
.mobile-submenu svg { flex-shrink:0; }.current { color:var(--color-brand-red); }
a:focus-visible,button:focus-visible { outline:2px solid var(--header-focus); outline-offset:3px; }
@media (min-width:768px) { .mobile-menu { display:grid; grid-template-columns:.55fr 1fr; gap:30px 6%; padding-top:36px; }.menu-intro p:last-child { display:block; margin-top:72px; font-size:var(--text-section); line-height:var(--leading-heading); max-width:400px; text-wrap:balance; } }
@media (min-width:1440px) {
 .header-inner { gap:12px; }.desktop-nav { display:flex; flex:1; align-self:stretch; min-width:0; }
 .nav-item { position:relative; display:flex; flex:1 1 auto; min-width:min-content; box-shadow:inset 1px 0 var(--rule-dark); }.nav-item:last-child { box-shadow:inset 1px 0 var(--rule-dark),inset -1px 0 var(--rule-dark); }
 .nav-entry { --submenu-toggle-width:24px; position:relative; display:flex; align-items:stretch; width:100%; color:var(--header-fg); transition:color .2s,background-color .2s; }
 .nav-page { --nav-label-inset:9px; display:flex; align-items:center; justify-content:center; flex:1; min-width:0; padding:12px 0 12px var(--nav-label-inset); font-size:var(--text-small); font-weight:var(--font-weight-medium); line-height:var(--leading-compact); text-align:center; overflow-wrap:normal; word-break:normal; hyphens:none; }
 .nav-page :deep(.hover-label) { max-width:16ch; min-width:min-content; white-space:normal; text-wrap:balance; }
 .nav-entry-leaf .nav-page { padding-inline:calc((var(--nav-label-inset) + var(--submenu-toggle-width)) / 2); }
 .submenu-toggle { display:flex; align-items:center; justify-content:center; width:var(--submenu-toggle-width); padding:0 5px; flex-shrink:0; border:0; color:inherit; background:transparent; }
 .nav-entry::after { content:''; position:absolute; bottom:16px; left:calc(50% - 10px); width:20px; height:2px; background:var(--header-accent); transform:scaleX(0); transition:transform .2s; pointer-events:none; }
 .nav-entry.active,.nav-entry.expanded,.nav-entry:focus-within { color:var(--header-fg); background:var(--header-hover-bg); }.nav-entry.active::after,.nav-entry.expanded::after,.nav-entry:focus-within::after { transform:scaleX(1); }
 .desktop-submenu { --header-focus:var(--color-brand-red); position:absolute; top:100%; left:0; width:max-content; min-width:100%; max-width:320px; list-style:none; padding:4px 16px; color:var(--color-brand-text); background:#fff; border:1px solid var(--rule); border-top:2px solid var(--color-brand-red); box-shadow:0 16px 32px #18283212; }
 .desktop-submenu li + li { border-top:1px solid var(--rule); }.desktop-submenu a { display:flex; align-items:center; justify-content:center; padding:14px 0; font-size:var(--text-small); line-height:var(--leading-body); text-align:center; overflow-wrap:normal; word-break:normal; hyphens:none; }.desktop-submenu svg { display:none; }
 .menu-toggle,.mobile-menu { display:none; }
}
@media (hover:hover) and (pointer:fine) {
  .menu-toggle[aria-expanded="false"]:hover .menu-circle { border-color:white; background:var(--header-hover-bg); }
  .menu-toggle[aria-expanded="false"]:hover .menu-lines::before { transform:translate(3px,-4px) scaleX(.7); }
  .menu-toggle[aria-expanded="false"]:hover .menu-lines::after { transform:translate(-3px,4px) scaleX(.7); }
  .menu-toggle[aria-expanded="true"]:hover .menu-circle { background:#f4f5f2; border-color:#f4f5f2; }
  .menu-toggle[aria-expanded="true"]:hover .menu-lines { transform:rotate(90deg); }
  .nav-entry:hover { color:var(--header-fg); background:var(--header-hover-bg); }
  .desktop-submenu a:hover,.mobile-navigation a:hover { color:var(--color-brand-red); }
  .nav-entry:hover .hover-label { --label-shift:-100%; }
  .desktop-submenu a:hover svg { transform:translate(2px,-2px); }
  .desktop-submenu svg { transition:transform .2s; }
}
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none !important; } }
@media (max-width:767px) { .site-header { --brand-logo-width:min(144px, calc(100vw - 216px)); }.header-inner { gap:4px; }.header-inner :deep(.header-language) { padding-inline:8px; gap:5px; }.menu-toggle > span:first-child { display:none; } }

/* Studwell 默认展示；交互逻辑保持不变。 */

.site-header{--header-bg:#fff;--header-fg:#202b40;--header-accent:#254fdb;--header-focus:#254fdb;--header-hover-bg:#eef2ff;--rule-dark:#e6eaf0;box-shadow:0 1px 0 #e6eaf0}
.site-header :deep(.brand-logo){--image-extra-filter:none}
.site-header .header-inner{border-bottom:0}
.site-header .menu-circle{border-color:#d8dfed;border-radius:8px}
.site-header .menu-toggle:hover .menu-circle, .site-header .menu-toggle:focus-visible .menu-circle{border-color:#254fdb;background:#eef2ff}
.site-header .menu-toggle[aria-expanded="true"] .menu-circle{background:#254fdb;border-color:#254fdb;color:#fff}
.site-header .nav-item{box-shadow:none}
.site-header .nav-entry{border-radius:6px}
.site-header .mobile-menu{background:#f7f9fc;border-radius:0;border:0;box-shadow:none}
.site-header .mobile-row.active{background:#e8eefc}
@media(max-width:1439px){.site-header .mobile-menu{display:block}}
@media(min-width:768px) and (max-width:1439px){.site-header .mobile-menu{display:grid}}
</style>
