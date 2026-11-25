<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' }>(), {tone: 'neutral'})
</script>
<template><span class="admin-status-badge" :class="`admin-status-badge-${tone}`"><span class="admin-status-dot"
                                                                                       aria-hidden="true"/><slot/></span>
</template>
<style scoped>
.admin-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 3px 9px;
  border-radius: 6px;
  background: #f0f3f7;
  color: #596a7f;
  font-size: 12px;
  font-weight: 550;
  line-height: 1.6;
  white-space: nowrap;
}

.admin-status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.admin-status-badge-success {
  background: #eaf6ef;
  color: #267149;
}

.admin-status-badge-warning {
  background: #fff4df;
  color: #946014;
}

.admin-status-badge-danger {
  background: #fceef0;
  color: #ad3a4c;
}
</style>
