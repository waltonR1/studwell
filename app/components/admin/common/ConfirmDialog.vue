<script setup lang="ts">
import type {AdminConfirmation} from '~/types/admin/interaction'

defineProps<{ confirmation: AdminConfirmation | null }>()
const emit = defineEmits<{ settle: [accepted: boolean] }>()
</script>
<template>
  <div class="admin-action-confirm">
    <AdminCommonDialog size="compact" :open="!!confirmation" :title="confirmation?.title ?? ''"
                       :description="confirmation?.message" @close="emit('settle', false)">
      <template #actions>
        <UButton class="admin-button" @click="emit('settle', false)">{{ confirmation?.cancelLabel ?? '取消' }}</UButton>
        <UButton class="admin-button admin-button-danger" @click="emit('settle', true)">{{
            confirmation?.confirmLabel
          }}
        </UButton>
      </template>
    </AdminCommonDialog>
  </div>
</template>

<style scoped>
.admin-action-confirm :deep(.admin-overlay) {
  z-index: 60;
}

.admin-action-confirm :deep(.admin-dialog) {
  z-index: 61;
  width: min(92vw, 460px);
  padding: 26px;
  border-top: 3px solid #bd4e61;
}

.admin-action-confirm :deep(.admin-dialog h2) {
  color: #8e3042;
  font-size: 20px;
  margin-bottom: 12px;
}

.admin-action-confirm :deep(.admin-dialog h2 + p) {
  color: #647185;
  line-height: 1.8;
  margin-bottom: 6px;
  overflow-wrap: anywhere;
}

.admin-action-confirm :deep(.admin-dialog-actions) {
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.admin-action-confirm :deep(.admin-button-danger) {
  color: #fff;
  background: #ae3c50;
  border-color: #ae3c50;
}

.admin-action-confirm :deep(.admin-button-danger:hover:not(:disabled)) {
  background: #952f42;
  border-color: #952f42;
}
</style>
