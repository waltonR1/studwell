<!-- 手机端展示：初始保留拆分前的布局和响应式样式。 -->
<script setup lang="ts">
// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { usePublishedSection } from '~/composables/public/runtime/usePublicPage';
const { t: contentText } = usePublishedSection();
</script>
<template>
  <section class="container-shell text-content">
    <h2>{{ contentText('title') }}</h2>
    <p>{{ contentText('body') }}</p>
  </section>
</template>
<style scoped>
.text-content { padding-block: 40px; }
.text-content h2 { color: var(--color-brand-text); font-size: var(--text-card); }
.text-content p { white-space: pre-wrap; line-height: var(--leading-body); }
</style>
