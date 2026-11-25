<!-- 通用内页面包屑：上级链接统一本地化，末项为当前页，支持长名称换行与键盘导航。 -->
<script lang="ts" setup>
import {isExternalSiteLink} from '#shared/utils/website/site-link'
import type {RouteLocationRaw} from 'vue-router'

defineProps<{ items: { label: string; to?: RouteLocationRaw }[] }>()
const localePath = useLocalePath()
</script>

<template>
  <nav :aria-label="$t('common.breadcrumb')">
    <ol class="inner-breadcrumb">
      <li v-for="(item, index) in items" :key="index">
        <NuxtLink v-if="item.to && index < items.length - 1" :to="typeof item.to === 'string' && isExternalSiteLink(item.to) ? item.to : localePath(item.to)">{{ item.label }}</NuxtLink>
        <span v-else :aria-current="index === items.length - 1 ? 'page' : undefined">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
/* 样式由组件集中维护，各页仅负责面包屑与标题之间的间距。 */
.inner-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 0;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-brand-muted);
  font-size: var(--text-small);
  line-height: var(--leading-body);
}

.inner-breadcrumb li {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.inner-breadcrumb li + li::before {
  content: '/';
  flex-shrink: 0;
  margin-inline: 12px;
  opacity: .45;
}

.inner-breadcrumb a {
  text-underline-offset: 4px;
  transition: color 180ms;
}

.inner-breadcrumb a:hover {
  color: var(--color-brand-red);
  text-decoration: underline;
}

.inner-breadcrumb a:focus-visible {
  outline: 2px solid var(--color-brand-red);
  outline-offset: 3px;
}

.inner-breadcrumb [aria-current] {
  color: var(--color-brand-navy);
}

@media (prefers-reduced-motion: reduce) {
  .inner-breadcrumb a {
    transition: none;
  }
}
</style>
