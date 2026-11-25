<script setup lang="ts">
withDefaults(defineProps<{ minWidth?: number; label?: string }>(), {minWidth: 760, label: ''})
</script>

<template>
  <div class="admin-table-wrap">
    <table :aria-label="label || undefined" :style="{ minWidth: `${minWidth}px` }">
      <slot/>
    </table>
  </div>
</template>

<style scoped>
/* 文本默认左对齐；状态、操作与交互列居中；可比较的数字右对齐。表头和数据使用相同类。 */
.admin-table-wrap table :deep(th.admin-table-status),
.admin-table-wrap table :deep(td.admin-table-status),
.admin-table-wrap table :deep(th.admin-table-actions),
.admin-table-wrap table :deep(td.admin-table-actions),
.admin-table-wrap table :deep(th.admin-table-center),
.admin-table-wrap table :deep(td.admin-table-center) {
  text-align: center;
}

.admin-table-wrap table :deep(td.admin-table-actions > div),
.admin-table-wrap table :deep(td.admin-table-status > div),
.admin-table-wrap table :deep(td.admin-table-center > div) {
  justify-content: center;
}

.admin-table-wrap table :deep(td.admin-table-actions > *) {
  margin-right: 0;
}

.admin-table-wrap table :deep(th.admin-table-number),
.admin-table-wrap table :deep(td.admin-table-number) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
