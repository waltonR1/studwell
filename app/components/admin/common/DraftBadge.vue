<script setup lang="ts">
defineProps<{ dirty: boolean }>()
</script>
<template><small class="admin-draft-badge" :class="{ 'is-dirty': dirty }">
  <slot>{{ dirty ? '有未保存修改' : '无未保存修改' }}</slot>
</small></template>
<style scoped>
.admin-draft-badge {
  display: inline-block;
  max-width: 100%;
  padding: 3px 8px;
  border-radius: 5px;
  background: #f3f6f9;
  color: #8a97a7;
  font-size: 11px;
  font-weight: 400;
}

.admin-draft-badge.is-dirty {
  background: #fff4df;
  color: #976616;
}
</style>
