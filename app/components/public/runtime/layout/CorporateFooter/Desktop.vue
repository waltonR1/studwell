<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import BrandLogo from '~/components/public/runtime/layout/BrandLogo.vue';
import { useCorporateFooter } from '~/composables/public/runtime/layout/useCorporateFooter';
const viewSetup = useCorporateFooter();
const viewResolved = await viewSetup.pending;
const { brandName, settings, footer, localePath, contactHref, groups, contactLink } = viewSetup.resume(viewResolved);
</script>
<template>
  <footer v-if="footer && settings" class="editorial-footer">
    <div class="container-shell footer-grid">
      <div class="footer-brand">
        <NuxtLink :to="localePath('/')" class="brand" :aria-label="brandName"><BrandLogo /></NuxtLink>
        <p class="footer-description">{{ footer.description }}</p>
      </div>
      <nav v-for="group in groups" :key="group.id" :aria-label="group.title" class="footer-navigation">
        <h2 class="eyebrow">{{ group.title }}</h2>
        <NuxtLink v-for="item in group.items" :key="item.id" :to="item.to">{{ item.label }}</NuxtLink>
      </nav>
      <div class="footer-contact">
        <h2 class="eyebrow"><NuxtLink v-if="contactLink" :to="contactLink" class="footer-contact-heading">{{ footer.contactTitle }} <span aria-hidden="true">↗</span></NuxtLink><span v-else>{{ footer.contactTitle }}</span></h2>
        <dl class="footer-contact-details">
          <div v-for="contact in footer.contacts" :key="contact.id"><dt>{{ contact.label }}</dt><dd><a v-if="contactHref(contact)" :href="contactHref(contact)">{{ contact.value }}</a><template v-else>{{ contact.value }}</template></dd></div>
        </dl>
      </div>
    </div>
    <div class="container-shell footer-copyright"><span>© {{ new Date().getFullYear() }} {{ footer.copyrightHolder }}</span></div>
  </footer>
</template>
<style scoped>
/* 沿用 Header 品牌红配色；静态弧面装饰不影响交互。 */
.editorial-footer { --footer-secondary: #F5E9EC; --footer-rule: rgba(255,255,255,.22); position: relative; isolation: isolate; overflow: hidden; background: #a9162a; color: var(--footer-secondary); }
.editorial-footer::before { content: ""; position: absolute; z-index: -1; pointer-events: none; inset: 0; background: radial-gradient(ellipse 80% 150% at 110% 130%, transparent 49%, rgba(255,255,255,.045) 55%, rgba(255,255,255,.015) 66%, transparent 73%); }
.footer-grid { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,.7fr) minmax(0,.7fr) minmax(0,1.3fr); gap: 4%; align-items: start; padding-block: 40px 32px; }
.footer-grid > * { min-width: 0; }
.footer-grid p, .footer-grid a, .footer-grid h2 { overflow-wrap: anywhere; }
/* 与 Header 共用品牌资源及反白处理，保留原始比例。 */
.footer-brand { --brand-logo-width: 150px; }
.footer-brand .brand :deep(.brand-logo) { --image-extra-filter: brightness(0) invert(1); }
.footer-description { margin-top: 18px; max-width: 32ch; font-size: var(--text-small); line-height: var(--leading-compact); }
.footer-navigation { display: grid; align-content: start; }
.footer-navigation h2, .footer-contact h2 { margin-bottom: 12px; color: #fff; font-weight: var(--font-weight-semibold); }
.footer-navigation h2::after, .footer-contact h2::after { content: ""; display: block; width: 26px; height: 2px; margin-top: 10px; background: rgba(255,255,255,.65); }
.footer-navigation > a { padding-block: 7px; font-size: var(--text-small); line-height: var(--leading-compact); }
.footer-grid a:hover { color: #fff; }
.footer-grid a:focus-visible { outline: 2px solid var(--footer-secondary); outline-offset: 4px; }
.footer-contact-heading { display: inline-flex; align-items: center; gap: 10px; }
.footer-contact-heading > span { color: var(--footer-secondary); }
.footer-contact-details { display: grid; gap: 8px; font-size: var(--text-small); line-height: var(--leading-compact); }
/* 标签供辅助技术读取，视觉上不重复显示。 */
.footer-contact-details dt { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.footer-contact-details dd { margin: 0; overflow-wrap: anywhere; }
.footer-contact-details > :last-child { margin-top: 2px; }
.footer-copyright { border-top: 1px solid var(--footer-rule); text-align: center; padding-block: 16px; font-size: var(--text-label); overflow-wrap: anywhere; }
@media (max-width: 1023px) {
  .footer-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 28px 36px; }
}
@media (max-width: 767px) {
  .editorial-footer::before { opacity: .45; }
  .footer-grid { grid-template-columns: minmax(0,1fr); gap: 0; padding-block: 20px 16px; }
  /* 手机仅保留联系方式和版权，不为品牌区或导航预留空间。 */
  .footer-brand, .footer-navigation, .footer-contact h2 { display: none; }
  .footer-contact-details { gap: 6px; }
  .footer-copyright { padding-block: 10px; }
}

/* Studwell 默认展示；交互逻辑保持不变。 */

.editorial-footer{--footer-secondary:#d7e0f2;--footer-rule:#ffffff24;background:#172641}
.editorial-footer .footer-grid{grid-template-columns:minmax(0,1.1fr) minmax(0,1.5fr) minmax(0,1fr);gap:32px;padding-block:24px}
.editorial-footer .footer-navigation{display:flex;flex-wrap:wrap;align-content:start;gap:4px 22px}
.editorial-footer .footer-navigation h2{flex-basis:100%}
.editorial-footer .footer-navigation>a{flex-basis:calc(50% - 11px)}
@media(max-width:767px){
 .editorial-footer .footer-grid{grid-template-columns:minmax(0,1fr);gap:16px;padding-block:18px}
 .editorial-footer .footer-navigation{gap:4px 16px}
}
</style>
