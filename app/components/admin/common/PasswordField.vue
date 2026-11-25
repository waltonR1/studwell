<script setup lang="ts">
import {Eye, EyeOff} from 'lucide-vue-next'

defineOptions({inheritAttrs: false})
const props = withDefaults(defineProps<{
  modelValue: string;
  disabled?: boolean;
  autocomplete?: string
}>(), {autocomplete: 'new-password'})
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [event: FocusEvent] }>()
const visible = ref(false)
watch(() => props.modelValue, value => {
  if (!value) visible.value = false
})
watch(() => props.disabled, value => {
  if (value) visible.value = false
})
</script>
<template>
  <div class="admin-password-input">
    <input v-bind="$attrs" class="admin-input" :value="modelValue" :type="visible ? 'text' : 'password'"
           :autocomplete="autocomplete" :disabled="disabled"
           @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)" @blur="emit('blur', $event)">
    <button type="button" class="admin-password-toggle" :disabled="disabled"
            :aria-label="visible ? '隐藏密码' : '显示密码'" :aria-pressed="visible" @click="visible = !visible">
      <Eye v-if="visible" aria-hidden="true"/>
      <EyeOff v-else aria-hidden="true"/>
    </button>
  </div>
</template>
<style scoped>
.admin-password-input {
  position: relative;
  min-width: 0;
  width: 100%;
}

.admin-password-input > input.admin-input {
  width: 100%;
  box-sizing: border-box;
  padding-right: 44px;
}

.admin-password-input > button.admin-password-toggle {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 32px;
  height: 30px;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #77899e;
  cursor: pointer;
}

.admin-password-input > button.admin-password-toggle:hover:not(:disabled) {
  background: #edf3f9;
  color: #245b91;
}

.admin-password-toggle svg {
  width: 17px;
  height: 17px;
}
</style>
