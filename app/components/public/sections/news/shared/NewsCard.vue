<!-- 新闻卡片：整卡进入详情，统一展示封面、分类、日期、标题与摘要，不显示浏览量。 -->
<script setup lang="ts">
import {useNewsPath} from '~/composables/public/sections/news/useNewsPath'
const newsPath = useNewsPath()
import type { PublicNewsSummary as NewsSummary } from '#shared/types/public/news'
import NewsImage from '~/components/public/sections/news/shared/NewsImage.vue'
const {article}=defineProps<{ article: NewsSummary; showDate?: boolean; showSummary?: boolean }>()
const localePath = useLocalePath()
const path=computed(()=>newsPath(article.slug))
const link=resolveComponent('NuxtLink')
</script>

<template>
  <component :is="path ? link : 'article'" v-bind="path ? {to:localePath(path)} : {}" class="news-card" :aria-labelledby="`news-card-${article.id}`">
    <div v-if="article.coverImage" class="news-card-image"><NewsImage :image="article.coverImage" sizes="sm:100vw md:50vw lg:33vw" /></div>
    <div class="news-card-copy">
      <div class="news-card-meta"><span>{{ article.category.name }}</span><time v-if="showDate !== false" :datetime="article.publishedAt">{{ article.publishedAt.replaceAll('-', '.') }}</time></div>
      <h3 :id="`news-card-${article.id}`">{{ article.title }}</h3>
      <p v-if="showSummary !== false" class="news-card-summary">{{ article.summary }}</p>
    </div>
  </component>
</template>

<style scoped>
/* 不截断多语言标题与摘要；卡片只展示新闻信息，整卡作为详情入口。 */
.news-card { display: flex; flex-direction: column; min-width: 0; border-bottom: 1px solid var(--rule); }
.news-card-image { aspect-ratio: 16/9; overflow: hidden; }
.news-card-image :deep(.media-photo) { transition: transform 500ms cubic-bezier(.22,1,.36,1); }
.news-card-copy { display: flex; flex-direction: column; flex: 1; padding-block: 20px 22px; }
.news-card-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--color-brand-muted); font-size: var(--text-label); line-height: var(--leading-body); }
.news-card-meta > span { color: var(--color-brand-red); }
.news-card h3 { margin-top: 14px; font-size: var(--text-card); font-weight: var(--font-weight-semibold); line-height: var(--leading-heading); overflow-wrap: anywhere; transition: color 200ms; }
.news-card-summary { margin-top: 12px; color: var(--color-brand-muted); font-size: var(--text-small); line-height: var(--leading-body); overflow-wrap: anywhere; }
.news-card:focus-visible { outline: 2px solid var(--color-brand-red); outline-offset: 5px; }
/* 同行卡片共享四条内容轨道，由最长标题和摘要撑高，避免后续信息起点错位。 */
@media (min-width:768px) {
  .news-card { margin-bottom: 32px; }
  @supports (grid-template-rows: subgrid) {
    .news-card { display: grid; grid-row: span 4; grid-template-rows: subgrid; row-gap: 0; }
    .news-card-copy { display: contents; }
    .news-card-image { grid-row: 1; align-self: start; }
    .news-card-meta { grid-row: 2; align-self: start; margin-top: 20px; }
    .news-card h3 { grid-row: 3; align-self: start; }
    .news-card-summary { grid-row: 4; align-self: start; margin-bottom: 22px; }
  }
}
@media (hover:hover) and (pointer:fine) { .news-card:hover h3 { color: var(--color-brand-red); } .news-card:hover :deep(.media-photo) { transform: scale(1.035); } }
/* 普通短入场仅在节点挂载时播放，筛选后新卡片自然显示，不绑定滚动或生成占位。 */
@media (prefers-reduced-motion:no-preference) { .news-card { animation: news-card-enter 420ms ease-out both; } }
@keyframes news-card-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width:767px) { .news-card-copy { padding-block: 18px 20px; } .news-card h3 { font-size: var(--text-card); } }
@media (prefers-reduced-motion:reduce) { .news-card h3, .news-card-image :deep(.media-photo) { transition: none; } .news-card:hover :deep(.media-photo) { transform: none; } }
</style>
