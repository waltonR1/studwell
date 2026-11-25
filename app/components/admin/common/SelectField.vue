<script setup lang="ts">
import {ChevronDown} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string;
  items: Array<{ label: string; value: string; disabled?: boolean }>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  bodyLock?: boolean;
  wideMenu?: boolean;
  commitFocusedField?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [] }>()
const empty = '__admin_all__'
const options = computed(() => props.items.map(item => ({...item, value: item.value || empty})))
const selectedValue = computed(() => props.modelValue || (props.items.some(item => item.value === '') ? empty : undefined))

function handleTriggerPointerDown(event: PointerEvent) {
  if (!props.commitFocusedField || props.disabled || event.button !== 0 || !event.isPrimary) return
  const focused = document.activeElement
  if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ||
      (focused instanceof HTMLElement && focused.isContentEditable)) focused.blur()
}

function update(value: unknown) {
  emit('update:modelValue', value === empty ? '' : String(value))
  emit('change')
}
</script>
<template>
  <div class="admin-select" @pointerdown.capture="handleTriggerPointerDown">
    <USelect :model-value="selectedValue" :placeholder="placeholder ?? '请选择'" :items="options" :aria-label="label" :disabled="disabled"
             portal=".admin-shell[data-admin-shell]" :content="{ position: 'popper', sideOffset: 6, collisionPadding: 12, bodyLock: bodyLock ?? true }"
             :ui="{ base: 'admin-select-trigger', content: wideMenu ? 'admin-select-content admin-select-wide' : 'admin-select-content', viewport: 'admin-select-viewport', item: 'admin-select-item', itemTrailingIcon: 'admin-select-check' }"
             @update:model-value="update">
      <template v-if="$slots['content-bottom']" #content-bottom><slot name="content-bottom" /></template>
      <template #trailing>
        <ChevronDown class="admin-select-chevron" aria-hidden="true"/>
      </template>
    </USelect>
  </div>
</template>

<style scoped>
.admin-select {
  flex: 0 0 auto;
  min-width: 104px;
  max-width: 100%;
}

:deep(.admin-select-trigger) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #dbe2eb;
  border-radius: 8px;
  background: #fff;
  color: #526278;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

:deep(.admin-select-trigger [data-slot='value']) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.admin-select-trigger [data-slot='trailing']) {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

:deep(.admin-select-trigger[data-state='open']) {
  border-color: #779abd;
  box-shadow: 0 0 0 3px #eaf1f9;
}

:deep(.admin-select-chevron) {
  width: 14px;
  height: 14px;
  color: #8a99ac;
}
</style>

<style>
/* Menus live outside the trigger and dialog scroll container, within the admin shell. */
.admin-shell[data-admin-shell] .admin-select-content {
  z-index: 80;
  width: var(--reka-select-trigger-width);
  min-width: var(--reka-select-trigger-width);
  box-sizing: border-box;
  max-height: min(280px, var(--reka-select-content-available-height));
  padding: 5px;
  overflow: hidden;
  border: 1px solid #e1e8f1;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 10px 32px #24364b1f;
}

.admin-shell[data-admin-shell] .admin-select-viewport {
  max-height: min(270px, calc(var(--reka-select-content-available-height) - 10px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0;
}

.admin-shell[data-admin-shell] .admin-select-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 6px;
  border-radius: 6px;
  color: #586d84;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}

.admin-shell[data-admin-shell] .admin-select-item [data-slot='itemLabel'] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-shell[data-admin-shell] .admin-select-item[data-highlighted] {
  background: #f0f5fb;
  color: #245886;
}

.admin-shell[data-admin-shell] .admin-select-item[data-state='checked'] {
  color: #235a93;
  font-weight: 550;
}

.admin-shell[data-admin-shell] .admin-select-content [data-slot='itemTrailing'] {
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
}

.admin-shell[data-admin-shell] .admin-select-check {
  display: inline-block;
  width: 14px;
  height: 14px;
}
.admin-shell[data-admin-shell] .admin-select-content.admin-select-wide {
  width:240px;
  min-width:min(240px,calc(100vw - 24px));
  max-width:calc(100vw - 24px);
}
</style>
