<!-- 新闻图片：直接展示 API 返回的本地图片与当前语言替代文本。 -->
<script setup lang="ts">
import SiteImage from '~/components/public/ui/SiteImage.vue'
import type { PublicNewsImage as NewsImage } from '#shared/types/public/news'
withDefaults(defineProps<{ image: NewsImage; priority?: boolean; sizes?: string }>(), { priority: false, sizes: 'sm:100vw md:50vw lg:33vw' })
</script>

<template>
  <div class="news-image industrial-visual">
    <SiteImage :optimized="!image.src.startsWith('/api/')" class="media-photo" :image="image" width="1672" height="941" :sizes="sizes" :loading="priority ? 'eager' : 'lazy'" :fetchpriority="priority ? 'high' : 'auto'" format="webp" />
  </div>
</template>

<style scoped>
/* 保留既有新闻图片的裁切和动画选择器，不添加加载切换特效。 */
.news-image { width: 100%; height: 100%; min-height: 0; overflow: hidden; }
.news-image img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
