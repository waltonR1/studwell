<script setup lang="ts">
const props = defineProps<{ text?: string; focusable?: boolean; disabledTarget?: boolean }>()
const open = ref(false)
watch(() => props.text, () => {
  open.value = false
})
</script>
<template>
  <UTooltip v-model:open="open" :portal="true" :text="text" :disabled="!text" :delay-duration="250"
            :content="{ side: 'top', sideOffset: 8, collisionPadding: 12 }"
            :ui="{ content: 'admin-tooltip-content', text: 'admin-tooltip-text' }">
    <span class="admin-tooltip-trigger" :class="{ 'admin-tooltip-disabled-target': disabledTarget }"
          :tabindex="text && (focusable || disabledTarget) ? 0 : undefined" @focusin="open = !!text"
          @focusout="open = false"><slot/></span>
  </UTooltip>
</template>
<style scoped>
.admin-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  vertical-align: middle;
}

.admin-tooltip-trigger:focus-visible {
  outline: 2px solid #3269a5;
  outline-offset: 3px;
  border-radius: 5px;
}

.admin-tooltip-disabled-target {
  cursor: not-allowed;
}

.admin-tooltip-disabled-target :deep(button:disabled) {
  pointer-events: none;
}

:global(.admin-tooltip-content) {
  z-index: 100;
  height: auto;
  max-width: min(320px, calc(100vw - 24px));
  padding: 9px 12px;
  border: 1px solid #dce5ef;
  border-radius: 8px;
  background: #fff;
  color: #445b73;
  box-shadow: 0 6px 24px #1e35451f;
  font-size: 12px;
  line-height: 1.6;
}

:global(.admin-tooltip-text) {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>
