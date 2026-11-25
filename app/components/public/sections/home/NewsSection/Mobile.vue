<!-- 手机端展示：独立布局与样式。 -->
<script setup lang="ts">
import { useNewsMotion } from '~/composables/public/sections/home/useNewsMotion';
import { ArrowUpRight } from 'lucide-vue-next';
import NewsImage from '~/components/public/sections/news/shared/NewsImage.vue';
import { useHomeNewsSection } from '~/composables/public/sections/home/useHomeNewsSection';
const viewSetup = useHomeNewsSection();
const viewResolved = await viewSetup.pending;
const { contentText, newsPath, localePath, available, featured, remaining } = viewSetup.resume(viewResolved);
const motionRoot = ref<HTMLElement | null>(null);
useNewsMotion(motionRoot);
</script>
<template>
  <section ref="motionRoot" class="section-space editorial-news">
    <div class="container-shell news-stage">
    <div class="news-heading">
      <h2 class="section-title">{{ contentText('title') }}</h2>
      <NuxtLink v-if="available && newsPath()" :to="localePath(newsPath())" class="text-link news-center-link">
        {{ contentText('all') }} <ArrowUpRight :size="18" aria-hidden="true" />
      </NuxtLink>
    </div>
    <!-- 首页与新闻列表共用文章 slug，整个新闻入口跳转到对应详情页。 -->
    <div v-if="featured && newsPath(featured.slug)" class="home-news-grid">
      <NuxtLink :to="localePath(newsPath(featured.slug))" :data-motion-key="featured.id" class="featured-news">
        <div class="featured-news-image">
          <NewsImage v-if="featured.coverImage" :image="featured.coverImage" sizes="sm:100vw md:100vw lg:45vw xl:45vw" />
        </div>
        <div class="home-news-meta">
          <span>{{ featured.category.name }}</span>
          <time :datetime="featured.publishedAt">{{ featured.publishedAt.replaceAll('-', '.') }}</time>
        </div>
        <h3 class="featured-news-title">{{ featured.title }}</h3>
        <p class="home-news-summary">{{ featured.summary }}</p>
      </NuxtLink>
      <!-- 次要新闻：沿用主推文章的分类、日期、标题和摘要结构。 -->
      <div class="home-news-list">
        <NuxtLink v-for="item in remaining.filter(item=>newsPath(item.slug))" :key="item.id" :to="localePath(newsPath(item.slug))" :data-motion-key="item.id" class="home-news-item">
          <div class="home-news-meta">
            <span>{{ item.category.name }}</span>
            <time :datetime="item.publishedAt">{{ item.publishedAt.replaceAll('-', '.') }}</time>
          </div>
          <h3>{{ item.title }}</h3>
          <p class="home-news-summary">{{ item.summary }}</p>
        </NuxtLink>
      </div>
    </div>
    </div>
  </section>
</template>
<style scoped>
/* 局部样式：限定本组件的布局、信息层级与交互外观。 */
.editorial-news {
  background: #fff;
}
.news-stage {
  padding-top: clamp(28px, 5dvh, 64px);
}
.featured-news, .home-news-list, .home-news-item {
  min-width: 0;
}
.featured-news, .home-news-item {
  display: block;
}
.featured-news:focus-visible, .home-news-item:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 6px;
}
.featured-news-image {
  aspect-ratio: 16 / 9;
  overflow: hidden;
}
.featured-news-image > :deep(.industrial-visual) {
  width: 100%;
  height: 100%;
  min-height: 0;
}
.featured-news-image :deep(.media-photo) {
  transition: transform 550ms ease;
}
.home-news-meta > span {
  color: var(--color-brand-red);
}
.home-news-meta time {
  font-variant-numeric: tabular-nums;
}
h3 {
  margin: 0;
  font-size: var(--text-card);
  line-height: var(--leading-heading);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-heading);
  overflow-wrap: anywhere;
  transition: color 300ms ease;
}
.featured-news-title {
  color: var(--color-brand-text);
}
.home-news-list {
  display: flex;
  flex-direction: column;
}
.home-news-item:last-child {
  border-bottom: 1px solid var(--rule);
}
.home-news-item .home-news-meta {
  margin-top: 0;
}
.news-center-link svg {
  flex-shrink: 0;
  transition: transform 300ms ease;
}
.news-center-link:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 6px;
}
/* 悬停反馈：仅在设备支持悬停时提供 Hover 效果。 */
@media (hover: hover) and (pointer: fine) {
  .featured-news:hover .featured-news-image :deep(.media-photo) {
    transform: scale(1.04);
  }
  .featured-news:hover h3, .home-news-item:hover h3 {
    color: var(--color-brand-red);
  }
  .news-center-link:hover svg {
    transform: translate(3px, -3px);
  }
}
.news-heading .section-title {
  flex-basis: 100%;
  min-width: 0;
}
.home-news-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 32px;
}
.home-news-item {
  flex: 1;
  border-top: 1px solid var(--rule);
  padding-block: 24px;
}
.news-heading {
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  display: block;
  margin-bottom: 32px;
}
.news-heading .section-title::before {
  content: '';
  display: block;
  width: 34px;
  height: 4px;
  margin-bottom: 16px;
  background: var(--color-brand-red);
}
.news-center-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-brand-red);
  margin-top: 20px;
}
.home-news-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: var(--text-label);
  line-height: var(--leading-body);
  color: var(--color-brand-muted);
  margin-block: 18px 12px;
  gap: 6px 16px;
}
.home-news-summary {
  font-size: var(--text-small);
  line-height: var(--leading-body);
  color: var(--color-brand-muted);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  margin-top: 12px;
}
/* 减少动态效果：遵循系统偏好，减少过渡与位移并保持内容可读。 */
@media (prefers-reduced-motion: reduce) {
  h3, .news-center-link svg, .featured-news-image :deep(.media-photo) {
    transition: none;
  }
  .featured-news:hover .featured-news-image :deep(.media-photo), .news-center-link:hover svg {
    transform: none;
  }
}
</style>
