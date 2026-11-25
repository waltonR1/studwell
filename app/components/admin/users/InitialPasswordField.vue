<!-- 账号创建与密码重置字段：按会话密码策略生成、预检和复制，秘密输入由父表单持有。 -->
<script setup lang="ts">
import {DEFAULT_PASSWORD_POLICY} from '#shared/config/admin/password'
import {isPasswordLengthValid} from '#shared/utils/admin/password'
import {useInitialPassword} from '~/composables/admin/forms/useInitialPassword'
import {useAdminSessionStore} from '~/stores/admin/session'
import {storeToRefs} from 'pinia'

const props = withDefaults(defineProps<{
  modelValue: string;
  id: string;
  label?: string;
  disabled?: boolean;
  error?: string;
  purpose?: 'create' | 'reset'
}>(), {label: '初始密码', error: '', purpose: 'create'})
const {session} = storeToRefs(useAdminSessionStore())
// 优先使用会话接口返回的有效策略；缺失时以共享默认范围生成、预检候选密码，不替代服务端提交校验。
const policy = computed(() => session.value?.passwordPolicy ?? DEFAULT_PASSWORD_POLICY)
const generatedLength = computed(() => Math.min(policy.value.maxLength, Math.max(policy.value.minLength, 20)))
const locallyTouched = ref(false)
watch(() => props.modelValue, value => {
  if (!value) locallyTouched.value = false
})
const visibleError = computed(() => props.error || (locallyTouched.value && props.modelValue && !isPasswordLengthValid(props.modelValue, policy.value) ? `密码须为 ${policy.value.minLength}–${policy.value.maxLength} 个字符。` : ''))
const emit = defineEmits<{ 'update:modelValue': [value: string]; blur: [] }>()
const {
  notice,
  generate,
  copy
} = useInitialPassword(() => props.modelValue, value => emit('update:modelValue', value), () => !!props.disabled, () => props.purpose, () => generatedLength.value)
</script>
<template>
  <div class="admin-password-field"><label :for="id" class="admin-password-label"><span
      class="admin-password-title">{{ label }} <span class="admin-password-required" aria-hidden="true">*</span></span></label>
    <div class="admin-password-controls">
      <AdminCommonPasswordField :id="id" :model-value="modelValue" autocomplete="new-password" required
                                :maxlength="policy.maxLength" :disabled="disabled" :aria-invalid="!!visibleError"
                                :aria-describedby="`${id}-help ${id}-error`"
                                @update:model-value="emit('update:modelValue', String($event))"
                                @blur="locallyTouched = true; emit('blur')"/>
      <UButton type="button" class="admin-button" :disabled="disabled" @click="generate">生成随机密码</UButton>
      <UButton type="button" class="admin-button" :disabled="disabled || !modelValue" @click="copy">复制密码</UButton>
    </div>
    <p :id="`${id}-help`">可手动输入 {{ policy.minLength }}–{{ policy.maxLength }} 个字符，或生成 {{ generatedLength }}
      位随机密码；提交时仍会进行安全校验。请在{{ purpose === 'reset' ? '重置' : '创建' }}前复制，提交失败后需重新设置。</p>
    <p v-if="notice" class="admin-password-notice" role="status">{{ notice }}</p><span :id="`${id}-error`"
                                                                                       class="admin-field-error"
                                                                                       aria-live="polite">{{
        visibleError || '\u00a0'
      }}</span></div>
</template>
<style scoped>
.admin-password-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.admin-password-label {
  display: inline-flex;
  gap: 4px;
  color: #526278;
  font-size: 13px;
  font-weight: 500;
}

.admin-password-title {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.admin-password-label .admin-password-required {
  color: #dc2626;
  font-weight: 600;
}

.admin-password-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-password-controls > :first-child {
  flex: 1 1 220px;
  min-width: 0;
}

.admin-password-controls > .admin-button {
  flex-shrink: 0;
}

p {
  margin: 0;
  color: #778497;
  font-size: 12px;
  line-height: 1.7;
}

.admin-password-notice {
  color: #245b91;
}
</style>
