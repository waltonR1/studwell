<!-- 手机端展示：独立布局与样式。 -->
<script setup lang="ts">
import NewsCard from '~/components/public/sections/news/shared/NewsCard.vue';
import { useNewsCatalogListSection } from '~/composables/public/sections/news/catalog/useNewsCatalogListSection';
const viewSetup = useNewsCatalogListSection();
const viewResolved = await viewSetup.pending;
const { t, contentText, data, list, error, pending, selectedCategory, page, notFound, lastPage, filterLocation } = viewSetup.resume(viewResolved);
</script>
<template>
  <section id="news-list" class="news-shell news-list" :aria-label="t('nav.news')">
    <div class="news-list-toolbar" :aria-busy="pending">
      <nav v-if="data.showFilters || notFound" class="news-filters" :aria-label="t('news.listSection.filterLabel')">
        <NuxtLink :to="filterLocation()" :class="{ active: !selectedCategory }" :aria-current="!selectedCategory ? 'true' : undefined">{{ contentText('all') }}</NuxtLink>
        <NuxtLink v-for="category in list?.categories ?? []" :key="category.id" :to="filterLocation(category.id)" :class="{ active: selectedCategory === category.id }" :aria-current="selectedCategory === category.id ? 'true' : undefined">{{ category.name }}</NuxtLink>
      </nav>
      <p v-if="list" class="news-result-count" role="status" aria-live="polite">{{ t('news.listSection.count', { count: list?.total ?? 0 }) }}</p>
    </div>
    <div v-if="list?.items.length" class="news-card-grid">
      <NewsCard v-for="article in list.items" :key="article.id" :article="article" :show-date="data.showDate" :show-summary="data.showSummary" />
    </div>
    <p v-else-if="error && !notFound" role="alert" class="news-list-empty">{{ t('news.listSection.failed') }}</p>
    <p v-else-if="!pending" class="news-list-empty">{{ contentText('empty') }}</p>
    <nav v-if="!pending && list && (lastPage > 1 || page > 1)" class="news-filters" :aria-label="t('news.listSection.pagination')">
      <NuxtLink v-if="page > 1" :to="filterLocation(selectedCategory, page > lastPage ? Math.max(1, lastPage) : page - 1)">{{ t('search.previous') }}</NuxtLink>
      <span v-if="lastPage && page <= lastPage">{{ t('search.pageCount', {page, count: lastPage}) }}</span>
      <NuxtLink v-if="page < lastPage" :to="filterLocation(selectedCategory, page + 1)">{{ t('search.next') }}</NuxtLink>
    </nav>
  </section>
</template>
<style scoped>
[id] {
  scroll-margin-top: calc(var(--header-height) + 20px);
}
/* 只有一个内容Section，顶部横线划分目录，不重复显示编号和英文栏目。 */
.news-filters a.active {
  background: var(--color-brand-red);
  color: white;
}
.news-filters a:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 3px;
}
.news-result-count {
  flex-shrink: 0;
  font-size: var(--text-small);
  color: var(--color-brand-muted);
}
.news-list-empty {
  padding-block: 64px;
  text-align: center;
  color: var(--color-brand-muted);
}
@media (hover:hover) {
  .news-filters a:not(.active):hover {
    color: var(--color-brand-red);
    background: white;
  }
}
.news-list {
  border-top: 1px solid var(--rule);
  padding-bottom: 48px;
}
.news-list-toolbar {
  display: flex;
  justify-content: space-between;
  flex-direction: column;
  align-items: stretch;
  gap: 16px;
  padding-block: 16px 24px;
}
.news-filters {
  display: flex;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
  overflow-x: auto;
  padding: 3px 3px 8px;
}
.news-filters a {
  display: block;
  color: var(--color-brand-muted);
  transition: color 180ms, background-color 180ms;
  flex-shrink: 0;
  padding: 10px 14px;
  font-size: var(--text-small);
}
.news-card-grid {
  display: grid;
  align-items: stretch;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (prefers-reduced-motion:reduce) {
  .news-filters a {
    transition: none;
  }
}
</style>
