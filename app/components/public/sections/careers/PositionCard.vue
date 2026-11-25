<!-- 招聘岗位组件：原生展开职责与要求，保留键盘操作，岗位咨询跳转现有联系页。 -->
<script setup lang="ts">
import InquiryLink from '~/components/public/sections/contact/InquiryLink.vue'
import type {PublicCareerPosition} from '#shared/types/public/careers'
import {usePublishedSection} from '~/composables/public/runtime/usePublicPage'
const {t: contentText,data} = usePublishedSection<{inquiryLink?: string}>()
import { Plus, ArrowUpRight } from 'lucide-vue-next'
defineProps<{ position: PublicCareerPosition }>()
</script>

<template>
  <details class="position-card">
    <summary>
      <div class="position-info">
        <h3>{{ position.title }}</h3>
        <p><span>{{ position.department }}</span><span aria-hidden="true">/</span><span>{{ position.location }}</span></p>
      </div>
      <Plus :size="22" aria-hidden="true" />
    </summary>
    <div class="position-content">
      <div v-if="position.responsibilities.length"><h4>{{ contentText('responsibilities') }}</h4><ul><li v-for="item in position.responsibilities" :key="item">{{ item }}</li></ul></div>
      <div v-if="position.requirements.length"><h4>{{ contentText('requirements') }}</h4><ul><li v-for="item in position.requirements" :key="item">{{ item }}</li></ul></div>
      <InquiryLink v-if="data.inquiryLink" :target="data.inquiryLink">{{ contentText('inquire') }}<ArrowUpRight :size="18" aria-hidden="true" /></InquiryLink>
    </div>
  </details>
</template>

<style scoped>
/* 原生details在无脚本时可用，不为未知业务信息生成假参数。 */
.position-card { border-top: 1px solid var(--rule); }
.position-card:last-child { border-bottom: 1px solid var(--rule); }
.position-card summary { display: grid; grid-template-columns: minmax(0,1fr) 22px; align-items: center; gap: 12px 24px; padding-block: 24px; cursor: pointer; list-style: none; }
.position-info { grid-column: 1; grid-row: 1; min-width: 0; }
.position-card summary::-webkit-details-marker { display: none; }
.position-card summary > svg { grid-column: 2; grid-row: 1 / span 2; transition: transform 180ms; }
.position-card[open] summary > svg { transform: rotate(45deg); }
.position-card h3 { font-size: var(--text-card); line-height: var(--leading-heading); overflow-wrap: anywhere; }
.position-card summary p { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; color: var(--color-brand-muted); font-size: var(--text-small); }
.position-content { max-width: 860px; padding-bottom: 32px; }
.position-content > div + div { margin-top: 24px; }
.position-content h4 { font-size: var(--text-card); font-weight: var(--font-weight-semibold); }
.position-content ul { margin-top: 12px; padding-left: 20px; list-style: disc; }
.position-content li { padding-block: 4px; font-size: var(--text-body); line-height: var(--leading-body); color: var(--color-brand-muted); }
.position-content > a { display: inline-flex; align-items: center; gap: 24px; margin-top: 24px; padding-bottom: 8px; border-bottom: 1px solid var(--rule); font-size: var(--text-small); }
@media (hover: hover) and (pointer: fine) {
  .position-card summary:hover, .position-content a:hover { color: var(--color-brand-red); }
}
.position-card summary:focus-visible, .position-content a:focus-visible { outline: 2px solid var(--color-brand-red); outline-offset: 4px; }
@media (max-width:767px) { .position-card h3 { font-size: var(--text-card); } .position-card summary { padding-block: 20px; } }
@media (prefers-reduced-motion:reduce) { .position-card summary > svg { transition: none; } }
</style>
