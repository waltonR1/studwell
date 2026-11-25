<!-- 手机端展示：独立布局与样式。 -->
<script setup lang="ts">
import Breadcrumb from '~/components/public/ui/Breadcrumb.vue';
import NewsImage from '~/components/public/sections/news/shared/NewsImage.vue';
import { useNewsDetailArticleSection } from '~/composables/public/sections/news/detail/useNewsDetailArticleSection';
const { newsPath, article, localePath, headings } = useNewsDetailArticleSection();
</script>
<template>
 <article v-if="article" class="news-article-page">
  <header class="news-shell news-detail-header">
    <Breadcrumb :items="[{ label: $t('nav.home'), to: '/' }, ...(newsPath() ? [{label:$t('nav.news'),to:newsPath()}] : []), { label: article.title }]" />
    <div class="news-article-column news-detail-heading">
      <NuxtLink v-if="article.category.name && newsPath()" class="news-detail-category" :to="localePath({ path: newsPath(), query: { category: article.category.id } })">{{ article.category.name }}</NuxtLink>
      <h1>{{ article.title }}</h1>
      <p class="news-detail-summary">{{ article.summary }}</p>
      <div class="news-detail-meta">
        <time :datetime="article.publishedAt">{{ article.publishedAt.replaceAll('-', '.') }}</time>
        <span v-if="article.viewCount !== null">{{ $t('news.viewCount', { count: article.viewCount }) }}</span>
      </div>
    </div>
  </header>
  <div class="news-shell news-detail-content">
    <div class="news-article-column">
      <div v-if="article.coverImage" class="news-detail-cover"><NewsImage :image="article.coverImage" priority sizes="sm:100vw md:100vw lg:860px xl:1120px" /></div>
      <!-- 保留已有章节跳转能力，按真实标题生成；不再为目录或文章信息预留侧栏。 -->
      <nav v-if="headings.length" :aria-label="$t('news.contents')" class="news-contents">
        <p>{{ $t('news.contents') }}</p>
        <ul><li v-for="heading in headings" :key="heading.id"><a :href="`#${heading.id}`">{{ heading.text }}</a></li></ul>
      </nav>
      <div class="news-detail-body">
        <template v-for="(block, index) in article.body" :key="index">
          <h2 v-if="block.type === 'heading'" :id="`news-heading-${index}`">{{ block.text }}</h2>
          <p v-else-if="block.type === 'paragraph'">{{ block.text }}</p>
          <figure v-else-if="block.type === 'image'" class="news-body-figure">
            <NewsImage :image="block.image" sizes="sm:100vw md:100vw lg:860px xl:1120px" />
            <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
          </figure>
        </template>
        <div v-if="article.source" class="news-detail-source">
          <span>{{ $t('news.source') }}</span>
          <a v-if="article.source.url" :href="article.source.url" target="_blank" rel="noopener noreferrer">{{ article.source.name }} ↗</a>
          <span v-else>{{ article.source.name }}</span>
        </div>
      </div>
    </div>
  </div>
 </article>
 <p v-else class="news-shell" role="status">{{ $t('news.detailPreview') }}</p>
</template>
<style scoped>
/* 新闻详情共享阅读轴线；列表沿用通用内页容器。 */
/* 大屏随视口放宽，避免文章区域被固定860px限制；小屏继续使用原阅读尺度。 */
:where(.news-article-page) .news-article-column {
  width: min(100%, var(--news-article-width));
  min-width: 0;
  margin-inline: auto;
}
.news-article-page {
  --news-article-width: 860px;
  --news-header: var(--header-height);
}
/* 单列标题区由内容撑高，不限定标题行数；元信息不再独占空间。 */
.news-detail-category {
  display: inline-block;
  color: var(--color-brand-red);
  font-size: var(--text-small);
  line-height: var(--leading-body);
  text-underline-offset: 4px;
}
.news-detail-category:hover {
  text-decoration: underline;
}
.news-detail-category:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 3px;
}
.news-detail-meta time {
  font-variant-numeric: tabular-nums;
}
.news-detail-header {
  padding-top: 24px;
}
.news-detail-heading {
  padding-block: 28px 24px;
}
.news-detail-heading h1 {
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-heading);
  overflow-wrap: anywhere;
  text-wrap: pretty;
  margin-top: 12px;
  font-size: var(--text-page);
  line-height: var(--leading-heading);
}
.news-detail-summary {
  color: var(--color-brand-muted);
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
  margin-top: 18px;
  font-size: var(--text-lead);
}
.news-detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  border-top: 1px solid var(--rule);
  color: var(--color-brand-muted);
  font-size: var(--text-label);
  line-height: var(--leading-body);
  margin-top: 20px;
  padding-top: 16px;
  gap: 6px 20px;
}
/* 正文以自然高度连续排版，缺少封面、章节或来源时不留占位。 */
.news-contents > p {
  color: var(--color-brand-text);
  flex-shrink: 0;
}
.news-contents a {
  color: var(--color-brand-muted);
  overflow-wrap: anywhere;
  text-underline-offset: 4px;
}
.news-contents a:hover, .news-detail-source a:hover {
  color: var(--color-brand-red);
  text-decoration: underline;
}
.news-contents a:focus-visible, .news-detail-source a:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 3px;
}
.news-body-figure :deep(.news-image), .news-body-figure :deep(img) {
  height: auto;
}
.news-body-figure figcaption {
  margin-top: 12px;
  color: var(--color-brand-muted);
  font-size: var(--text-small);
  line-height: var(--leading-body);
  overflow-wrap: anywhere;
}
.news-detail-source {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--rule);
  color: var(--color-brand-muted);
  font-size: var(--text-small);
  line-height: var(--leading-body);
}
.news-detail-content {
  padding-bottom: 36px;
}
.news-detail-cover {
  width: 100%;
  max-height: 420px;
  overflow: hidden;
  aspect-ratio: 16/10;
  margin-bottom: 24px;
}
.news-contents {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  border-block: 1px solid var(--rule);
  font-size: var(--text-small);
  line-height: var(--leading-body);
  gap: 8px 16px;
  margin-bottom: 24px;
  padding-block: 14px;
}
.news-contents ul {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
  gap: 6px 16px;
}
.news-detail-body > p {
  overflow-wrap: anywhere;
  font-size: var(--text-body);
  line-height: var(--leading-body);
  margin-top: 18px;
}
.news-detail-body > h2 {
  line-height: var(--leading-heading);
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
  scroll-margin-top: calc(var(--news-header) + 24px);
  margin-top: 28px;
  font-size: var(--text-card);
}
.news-detail-body > :first-child {
  margin-top: 0;
}
.news-body-figure {
  margin: 32px 0;
  margin-block: 24px;
}
</style>
