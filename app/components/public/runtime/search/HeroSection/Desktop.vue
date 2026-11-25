<!-- 电脑端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
import Breadcrumb from '~/components/public/ui/Breadcrumb.vue';
const { t } = useI18n();
</script>
<template>
  <header class="search-heading">
    <Breadcrumb :items="[{ label: t('nav.home'), to: '/' }, { label: t('search.title') }]" />
    <h1>{{ t('search.title') }}</h1>
    <p>{{ t('search.intro') }}</p>
  </header>
</template>
<style scoped>
.search-heading { padding-block: 40px 36px; }
.search-heading h1 { margin-top: 24px; font-size: var(--text-page); font-weight: var(--font-weight-semibold); line-height: var(--leading-heading); letter-spacing: var(--tracking-heading); }
.search-heading > p { max-width: 720px; margin-top: 18px; color: var(--color-brand-muted); line-height: var(--leading-body); font-size: var(--text-body); }
@media (max-width: 767px) {
  .search-heading { padding-block: 30px; }
  .search-heading h1 { margin-top: 20px; font-size: var(--text-page); }
  .search-heading > p { margin-top: 16px; font-size: var(--text-body); }
}
</style>
