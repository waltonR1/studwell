<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string; disabled?: boolean; busy?: boolean; size?: 'small' | 'medium'; layout?: 'inline' | 'row' }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>
<template>
  <div v-if="layout==='row'" class="admin-switch-row"><span>{{ label }}</span><button type="button" role="switch" class="admin-switch" :class="{ 'admin-switch-medium': size === 'medium' }" :aria-label="label" :aria-checked="modelValue" :aria-busy="busy || undefined" :disabled="disabled || busy" @click="emit('update:modelValue', !modelValue)"><span aria-hidden="true"/></button></div>
  <button v-else type="button" role="switch" class="admin-switch" :class="{ 'admin-switch-medium': size === 'medium' }"
          :aria-label="label" :aria-checked="modelValue" :aria-busy="busy || undefined" :disabled="disabled || busy"
          @click="emit('update:modelValue', !modelValue)"><span aria-hidden="true"/></button>
</template>
<style scoped>
.admin-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 48px; padding: 12px 14px; border: 1px solid #e1e8f1; border-radius: 8px; background: #f8fafc; color: #344961; font-size: 13px; line-height: 1.5; }
.admin-switch {
  display: inline-flex;
  align-items: center;
  flex: 0 0 32px;
  width: 32px;
  height: 18px;
  padding: 2px;
  border: 0;
  border-radius: 999px;
  background: #c6d0dc;
  cursor: pointer;
}

.admin-switch > span {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px #162b4030;
}

.admin-switch[aria-checked='true'] {
  background: #358365;
}

.admin-switch[aria-checked='true'] > span {
  transform: translateX(14px);
}

.admin-switch:disabled {
  opacity: .55;
  cursor: default;
}

.admin-switch:focus-visible {
  outline: 2px solid #3269a5;
  outline-offset: 3px;
}

.admin-switch-medium {
  flex-basis: 40px;
  width: 40px;
  height: 24px;
  padding: 3px;
}

.admin-switch-medium > span {
  width: 18px;
  height: 18px;
}

.admin-switch-medium[aria-checked='true'] > span {
  transform: translateX(16px);
}
</style>
