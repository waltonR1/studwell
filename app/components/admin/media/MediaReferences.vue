<!-- 只展示业务引用位置；名称与状态来自后端，语言合并由纯工具处理。 -->
<script setup lang="ts">
import type {MediaReference} from '#shared/types/admin/media'
import {groupMediaReferences} from '~/utils/admin/media/references'
const props=defineProps<{references:MediaReference[]}>()
const groups=computed(()=>groupMediaReferences(props.references))
</script>
<template>
  <section v-if="groups.length" class="media-reference-list" aria-label="引用位置">
    <h3>引用位置 <span>（{{ groups.length }} 处）</span></h3>
    <p class="media-reference-help">同一位置的多语言记录已合并。草稿和历史版本中的引用也会阻止删除。</p>
    <ul>
      <li v-for="group in groups" :key="group.key">
        <div class="media-reference-heading"><strong>{{ group.source }}</strong><UBadge color="neutral" variant="subtle">{{ group.status }}</UBadge></div>
        <p>{{ group.location }}</p>
        <p class="media-reference-languages">{{ group.languages }}</p>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.media-reference-list { margin-top:20px; }
h3 { margin:0; font-size:14px; font-weight:600; }
h3 span { font-weight:400; color:#64748b; }
.media-reference-help { margin:6px 0 12px; }
ul { display:grid; gap:10px; padding:0; margin:0; list-style:none; }
li { padding:12px; border:1px solid #e2e8f0; border-radius:8px; }
.media-reference-heading { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
strong { font-size:13px; color:#334155; overflow-wrap:anywhere; }
p { margin:6px 0 0; }
.media-reference-languages { color:#64748b; }
</style>
