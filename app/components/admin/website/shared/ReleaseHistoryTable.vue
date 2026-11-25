<script setup lang="ts">
import type {WebsiteMaintenanceAdapter} from '~/types/admin/website-maintenance'
import {formatBeijingTime} from '#shared/utils/beijing-time'

withDefaults(defineProps<{ releases: WebsiteMaintenanceAdapter['view']['value']['releases']; currentId: string | null; canPublish: boolean; canCleanup?: boolean; busy?: boolean; showDetail?: boolean;viewLabel?:string }>(), {showDetail:true,viewLabel:'查看版本'})
const emit = defineEmits<{ view: [id: string]; restore: [id: string]; cleanup:[id:string] }>()
</script>
<template>
  <AdminCommonTable v-if="releases.length" class="release-history-table" label="发布历史" :min-width="640">
    <colgroup>
      <col style="width:25%">
      <col style="width:22%">
      <col style="width:19%">
      <col style="width:34%">
    </colgroup>
    <thead>
    <tr>
      <th>发布时间</th>
      <th>发布人</th>
      <th class="admin-table-status">状态</th>
      <th class="admin-table-actions">操作</th>
    </tr>
    </thead>
    <tbody>
    <tr v-for="r in releases" :key="r.id">
      <td class="release-history-time">{{ formatBeijingTime(r.createdAt) }}</td>
      <td><AdminWebsiteSharedPublicationAuthor :author="r" /></td>
      <td class="admin-table-status">
        <UBadge :color="r.id === currentId ? 'primary' : 'neutral'" variant="soft" size="sm">{{ r.id === currentId ? '当前发布' : r.restoredFrom ? '历史回滚' : '历史版本' }}</UBadge>
      </td>
      <td class="admin-table-actions">
        <AdminCommonRowActions>
          <UButton v-if="showDetail" class="admin-button" :disabled="busy" @click="emit('view',r.id)">{{ viewLabel }}</UButton>
          <UButton v-if="canPublish&&r.id!==currentId" class="admin-button" :disabled="busy"
                   @click="emit('restore',r.id)">回滚
          </UButton>
          <UButton v-if="canCleanup&&r.id!==currentId" class="admin-button" data-tone="danger" :disabled="busy" @click="emit('cleanup',r.id)">清理</UButton>
        </AdminCommonRowActions>
      </td>
    </tr>
    </tbody>
  </AdminCommonTable>
  <AdminCommonDataState v-else state="empty" title="尚无发布记录"/>
  <p v-if="releases.length&&canCleanup" class="release-history-help">当前发布版本受保护。清理历史后无法恢复，图片文件仍保留在媒体库。</p>
</template>
<style scoped>
/* 固定操作列宽，复用后台按钮样式；窄屏由公共表格容器横向滚动。 */
.release-history-table :deep(table) {
  table-layout: fixed;
}

.release-history-table :deep(.admin-row-actions) {
  flex-wrap: nowrap;
}

.release-history-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.release-history-author {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.release-history-help {
  margin: 12px 0 0;
  color: var(--admin-view-muted);
  font-size: 12px;
  line-height: 1.6;
}
</style>
