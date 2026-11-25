<script setup lang="ts">
import {ChevronDown} from 'lucide-vue-next'
import {menuIconOptions} from '#shared/config/admin/menu-icons'
import type {MenuIconKey} from '#shared/types/admin/menus'

const props = defineProps<{ modelValue: MenuIconKey | ''; disabled?: boolean; error?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: MenuIconKey | ''] }>()
const expanded = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)

function select(key: MenuIconKey) {
  emit('update:modelValue', key)
  expanded.value = false
  trigger.value?.focus({preventScroll: true})
}

watch(() => props.disabled, value => {
  if (value) expanded.value = false
})
</script>
<template>
  <div class="menu-icon-picker">
    <span class="menu-icon-label">菜单图标 <span class="menu-icon-required" aria-hidden="true">*</span></span>
    <button ref="trigger" type="button" class="menu-icon-trigger" :disabled="disabled" :aria-expanded="expanded"
            :aria-invalid="!!error" aria-describedby="menu-icon-error" @click="expanded = !expanded">
      <AdminCommonMenuIcon v-if="modelValue" :icon-key="modelValue"/>
      <span>{{ modelValue ? '已选择图标' : '请选择图标' }}</span>
      <ChevronDown class="menu-icon-chevron" :class="{ 'is-expanded': expanded }" aria-hidden="true"/>
    </button>
    <div v-if="expanded" class="menu-icon-panel" @keydown.esc.stop.prevent="expanded = false; trigger?.focus()">
      <div class="menu-icon-options">
        <AdminCommonTooltip v-for="option in menuIconOptions" :key="option.key" :text="option.label">
          <button type="button" class="menu-icon-option" :class="{ 'is-selected': modelValue === option.key }"
                  :disabled="disabled" :aria-label="option.label" :aria-pressed="modelValue === option.key"
                  @click="select(option.key)">
            <AdminCommonMenuIcon :icon-key="option.key"/>
          </button>
        </AdminCommonTooltip>
      </div>
    </div>
    <p id="menu-icon-error" class="admin-field-error" aria-live="polite">{{ error }}</p>
  </div>
</template>
<style scoped>
.menu-icon-picker {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.menu-icon-required {
  color: #c34d59;
}

.menu-icon-picker .admin-field-error {
  margin: 6px 0 0;
}

.menu-icon-label {
  display: block;
  margin-bottom: 8px;
  color: #3e5670;
  font-size: 13px;
}

.menu-icon-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
  margin-top: 10px;
  max-height: 240px;
  overflow-y: auto;
  padding: 5px;
}

.menu-icon-options :deep(.admin-tooltip-trigger) {
  width: 100%;
}

.menu-icon-picker .menu-icon-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 44px;
  padding: 0;
  box-sizing: border-box;
  border: 1px solid #dce5ef;
  border-radius: 7px;
  background: #fff;
  color: #61748b;
  cursor: pointer;
}

.menu-icon-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.menu-icon-option :deep(svg) {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
}

.menu-icon-picker .menu-icon-option.is-selected {
  border-color: #91b4d8;
  background: #edf4fc;
  color: #245b91;
}

.menu-icon-picker .menu-icon-option:hover:not(:disabled) {
  border-color: #a9bfd7;
  background: #f3f7fc;
}

.menu-icon-option:focus-within {
  outline: 2px solid #3269a5;
  outline-offset: 1px;
}

.menu-icon-picker .menu-icon-option:disabled {
  opacity: .65;
  cursor: default;
}

.menu-icon-trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #dbe2eb;
  border-radius: 8px;
  background: #fff;
  color: #526278;
  font-size: 13px;
  text-align: left;
}

.menu-icon-trigger > :deep(svg) {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.menu-icon-trigger .menu-icon-chevron {
  width: 16px;
  height: 16px;
  margin-left: auto;
  color: #8a99ac;
}

.menu-icon-chevron.is-expanded {
  transform: rotate(180deg);
}

.menu-icon-trigger:disabled {
  cursor: default;
  background: #f6f8fb;
}

.menu-icon-panel {
  margin-top: 8px;
  padding: 6px;
  border: 1px solid #e1e8f1;
  border-radius: 8px;
  background: #fafbfd;
}

.menu-icon-panel .menu-icon-options {
  margin-top: 0;
}
</style>
