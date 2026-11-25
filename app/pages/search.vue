<!-- 搜索装配页：仅负责 SEO、页面外壳与区域组合。 -->
<script setup lang="ts">
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import HeroSection from '~/components/public/runtime/search/HeroSection.vue'
import SearchSection from '~/components/public/runtime/search/SearchSection.vue'
import ContentPage from '~/components/public/runtime/routes/ContentPage.vue'
import { usePageSeo } from '~/composables/public/runtime/seo/usePageSeo'
import '~/assets/public/css/runtime/search.css'
const {settings}=useSiteSettings()
const { t } = useI18n(), localePath = useLocalePath()
usePageSeo('search.title', 'search.intro')
useSeoMeta({ robots: 'noindex, follow' })
// noscript 由文档头生成，避免浏览器将其当作原始文本导致 Vue hydration 差异。
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const fallbackLinks = computed(() => (settings.value?.header?.items??[]).flatMap(({target,label}) => {
  const path = target.type==='page'?Object.values(settings.value?.pages??{}).find(page=>page.resourceId===target.resourceId)?.path:undefined
  return path ? [`<a href="${escapeHtml(localePath(path))}">${escapeHtml(label ?? '')}</a>`] : []
}).join(' / '))
useHead(() => ({ noscript: [{ innerHTML: `<p>${escapeHtml(t('search.noScript'))}</p>${fallbackLinks.value}` }] }))
</script>
<template>
  <ContentPage>
  <div class="search-page">
    <div class="search-shell">
      <HeroSection />
      <SearchSection />
    </div>
  </div>
  </ContentPage>
</template>

<style scoped>
.search-page { padding:0 0 80px; min-height:calc(100dvh - var(--header-height)); background:#f7f9fc; }
.search-shell { width:100%; max-width:1080px; margin-inline:auto; padding:0 40px; }
.search-page :deep(button), .search-page :deep(input) { font:inherit; }
.search-page :deep(button) { cursor:pointer; }
.search-page :deep(button:disabled) { cursor:default; opacity:.4; }
.search-page :deep(a) { text-decoration:none; }
.search-page :deep(:is(a,button):focus-visible) { outline:2px solid #254fdb; outline-offset:4px; }

.search-page :deep(.search-heading) { padding:48px 0 30px; }
.search-page :deep(.inner-breadcrumb) { color:#7d889a; font-size:13px; }
.search-page :deep(.search-heading h1) { margin:28px 0 0; color:#172641; font-size:42px; font-weight:700; line-height:1.25; letter-spacing:-1.2px; }
.search-page :deep(.search-heading > p) { margin:16px 0 0; max-width:640px; color:#69758a; font-size:16px; line-height:1.85; }
.search-page :deep(.search-form) { gap:14px; padding:8px 8px 8px 22px; border:1px solid #dce3ef; border-radius:12px; background:#fff; box-shadow:0 4px 18px #17264105; }
.search-page :deep(.search-form:focus-within) { border-color:#5476e4; box-shadow:0 0 0 3px #254fdb12; }
.search-page :deep(.input-icon) { width:21px; height:21px; color:#8491a8; }
.search-page :deep(.search-form input) { min-height:48px; font-size:16px; color:#202b40; }
.search-page :deep(.search-form input::placeholder) { color:#98a2b4; }
.search-page :deep(.search-submit) { min-height:48px; padding:12px 24px; gap:12px; border:0; border-radius:8px; background:#254fdb; color:#fff; font-size:14px; font-weight:600; }
.search-page :deep(.search-submit:hover) { background:#193da9; }
.search-page :deep(.clear-query) { width:40px; height:40px; border-radius:7px; color:#8390a5; }
.search-page :deep(.clear-query:hover) { color:#254fdb; background:#f0f3fb; }
.search-page :deep(.search-hint) { margin-top:14px; color:#8490a4; font-size:13px; line-height:1.8; }
.search-page :deep(.query-error) { margin-top:12px; color:#b42338; font-size:14px; }

.search-page :deep(.search-results) { margin-top:32px; }
.search-page :deep(.search-filters) { gap:8px; padding-bottom:0; border:0; }
.search-page :deep(.search-filters button) { gap:10px; min-height:40px; padding:8px 14px; border:1px solid transparent; border-radius:8px; color:#69758a; font-size:14px; }
.search-page :deep(.search-filters button:hover) { background:#edf1f9; }
.search-page :deep(.search-filters button[aria-pressed="true"]) { border-color:#dbe3fc; background:#eaf0ff; color:#254fdb; font-weight:600; }
.search-page :deep(.search-filters span) { display:grid; place-items:center; min-width:24px; height:22px; padding-inline:6px; border-radius:5px; background:#fff; font:12px/1 var(--font-sans); }
.search-page :deep(.result-heading) { margin:24px 0 16px; color:#7d889b; font-size:13px; font-weight:400; line-height:1.8; }
.search-page :deep(.result-list) { display:grid; gap:14px; }
.search-page :deep(.search-result) { padding:26px 28px; border:1px solid #e3e8f1; border-radius:12px; background:#fff; transition:border-color .15s,box-shadow .15s; }
.search-page :deep(.search-result:hover) { border-color:#bccbf3; box-shadow:0 6px 20px #254fdb06; }
.search-page :deep(.result-meta) { align-items:center; gap:8px 14px; color:#8a95a6; font-size:12px; line-height:1.6; }
.search-page :deep(.result-meta > span:first-child) { padding:3px 8px; border-radius:5px; background:#eff3fd; color:#4663ae; }
.search-page :deep(.search-result h3) { margin:13px 0 10px; font-size:21px; font-weight:600; line-height:1.55; letter-spacing:-.3px; color:#202f4a; }
.search-page :deep(.search-result h3 a) { align-items:center; gap:20px; color:inherit; }
.search-page :deep(.search-result h3 a:hover) { color:#254fdb; }
.search-page :deep(.search-result h3 svg) { width:20px; height:20px; color:#8b9bbe; }
.search-page :deep(.search-result p) { max-width:800px; margin:0; color:#738096; font-size:14px; line-height:1.9; }
.search-page :deep(mark) { padding:1px 2px; border-radius:3px; background:#eaf0ff; color:#254fdb; }

.search-page :deep(.search-initial) { gap:18px; min-height:250px; margin-top:28px; padding:40px 24px; border:1px solid #e3e8f1; border-radius:12px; background:#fff; }
.search-page :deep(.search-initial-icon) { width:64px; height:64px; background:#f1f5ff; color:#8ba1d7; }
.search-page :deep(.search-initial-icon svg) { width:29px; height:29px; }
.search-page :deep(.search-initial p) { max-width:480px; color:#8390a4; font-size:14px; line-height:1.9; }
.search-page :deep(.search-state) { margin-top:20px; padding:30px 28px; border:1px solid #e3e8f1; border-radius:12px; background:#fff; }
.search-page :deep(.search-state p) { color:#738096; font-size:14px; line-height:1.9; }
.search-page :deep(.text-action) { gap:10px; margin-top:12px; color:#254fdb; font-size:14px; }
.search-page :deep(.loading-line) { margin-block:28px; border-radius:2px; background:#254fdb; }
.search-page :deep(.search-pagination) { gap:8px; margin-top:28px; }
.search-page :deep(.search-pagination button) { min-width:40px; height:40px; border:1px solid #dfe5f0; border-radius:8px; background:#fff; color:#69758a; font-size:14px; }
.search-page :deep(.search-pagination button:hover:not(:disabled)) { border-color:#a9bcef; color:#254fdb; }
.search-page :deep(.search-pagination [aria-current]) { border-color:#254fdb; background:#254fdb; color:#fff; }
.search-page :deep(.search-pagination > span) { font-size:12px; color:#8a95a6; }

@media(max-width:760px) {
 .search-page { padding-bottom:48px; }
 .search-shell { padding-inline:24px; }
 .search-page :deep(.search-heading) { padding:30px 0 24px; }
 .search-page :deep(.search-heading h1) { margin-top:24px; font-size:32px; letter-spacing:-.6px; }
 .search-page :deep(.search-heading > p) { margin-top:12px; font-size:14px; }
 .search-page :deep(.search-form) { gap:6px; padding:6px; }
 .search-page :deep(.input-icon) { display:none; }
 .search-page :deep(.search-form input) { min-height:44px; padding-left:10px; font-size:15px; }
 .search-page :deep(.search-submit) { min-height:44px; padding:10px 16px; font-size:14px; }
 .search-page :deep(.search-submit svg) { display:none; }
 .search-page :deep(.clear-query) { width:34px; height:40px; }
 .search-page :deep(.search-results) { margin-top:24px; }
 .search-page :deep(.result-heading) { margin-block:20px 12px; }
 .search-page :deep(.search-result) { padding:20px; }
 .search-page :deep(.search-result h3) { font-size:18px; }
 .search-page :deep(.search-result p) { font-size:14px; }
 .search-page :deep(.search-initial) { min-height:220px; padding:30px 20px; }
 .search-page :deep(.search-pagination > span) { width:100%; margin:8px 0 0; }
}
@media(prefers-reduced-motion:reduce) { .search-page :deep(.search-result) { transition:none; } }
</style>
