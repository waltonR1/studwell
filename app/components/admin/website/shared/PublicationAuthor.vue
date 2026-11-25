<!-- 共用历史署名：紧凑展示用户名和账号状态，完整身份复用公共提示组件。 -->
<script setup lang="ts">
import type {PublicationRelease} from '#shared/types/admin/publication-history'
import {UserRound} from 'lucide-vue-next'
import {publicationAuthorLabel,publicationAuthorStatus} from '~/utils/admin/website/publication-author'
const {author}=defineProps<{author:Pick<PublicationRelease,'createdBy'|'createdByUsername'|'createdByStatus'>}>()
</script>
<template>
 <AdminCommonTooltip :text="publicationAuthorLabel(author)+' · 账号 ID：'+author.createdBy" focusable>
  <span class="publication-author" :data-state="author.createdByStatus" :aria-label="publicationAuthorLabel(author)+'，账号 ID：'+author.createdBy">
   <span class="publication-author-icon" aria-hidden="true"><UserRound :size="15" :stroke-width="1.8" /></span>
   <span class="publication-author-details">
    <span class="publication-author-name">{{ author.createdByUsername??'未知账号' }}</span>
    <UBadge v-if="author.createdByStatus!=='active'" class="publication-author-status" :color="author.createdByStatus==='disabled'?'warning':'neutral'" variant="soft" size="xs">{{ publicationAuthorStatus(author) }}</UBadge>
   </span>
  </span>
 </AdminCommonTooltip>
</template>
<style scoped>
.publication-author {
 display: inline-grid;
 grid-template-columns: 28px minmax(0, 1fr);
 align-items: center;
 gap: 8px;
 min-width: 0;
 max-width: 100%;
 border-radius: 4px;
 line-height: 20px;
 vertical-align: middle;
}

.publication-author-icon {
 display: flex;
 align-items: center;
 justify-content: center;
 width: 28px;
 height: 28px;
 border: 1px solid #d8e5f3;
 border-radius: 8px;
 background: #edf4fc;
 color: #3269a5;
}

.publication-author[data-state='disabled'] .publication-author-icon {
 border-color: #eddfbd;
 background: #fff8e9;
 color: #94671e;
}

.publication-author[data-state='deleted'] .publication-author-icon,
.publication-author[data-state='unknown'] .publication-author-icon {
 border-color: #e0e5eb;
 background: #f3f5f8;
 color: #778497;
}

.publication-author-details {
 display: flex;
 flex-direction: column;
 align-items: flex-start;
 gap: 3px;
 min-width: 0;
}

.publication-author-name {
 min-width: 0;
 max-width: 100%;
 overflow: hidden;
 font-size: 13px;
 font-weight: 600;
 color: #334b64;
 text-overflow: ellipsis;
 white-space: nowrap;
}

.publication-author-status {
 flex: none;
 white-space: nowrap;
}
</style>
