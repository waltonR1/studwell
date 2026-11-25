<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
  busy?: boolean
  size?: 'compact' | 'medium' | 'large' | 'wide' | 'preview'
}>(), {description: '', busy: false, size: 'large'})
const emit = defineEmits<{ close: [] }>()

function focusDialog(event: Event) {
  event.preventDefault()
  if (event.target instanceof HTMLElement) event.target.focus({preventScroll: true})
}
</script>

<template>
  <UModal
      :open="open"
      :title="title"
      :description="description || undefined"
      :portal="false"
      :close="false"
      :dismissible="!busy"
      :content="{ onOpenAutoFocus: focusDialog }"
      :ui="{ overlay: size === 'compact' ? 'admin-overlay admin-confirm-overlay' : 'admin-overlay', content: `admin-dialog admin-dialog-${size}` }"
      @update:open="value => { if (!value) emit('close') }"
  >
    <template #body>
      <slot/>
    </template>
    <template #footer>
      <div class="admin-dialog-actions">
        <slot name="actions"/>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.admin-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
</style>
