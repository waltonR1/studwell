<script setup lang="ts">
import ProfileFields from './ProfileFields.vue'
import type {AccountCreateTouched, AccountCreateDraft} from '~/types/admin/users'
import type {AccountDictionaryCatalog} from '#shared/types/admin/dictionaries'

defineProps<{
  open: boolean;
  busy: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  catalog: AccountDictionaryCatalog;
  catalogPending: boolean;
  catalogError: string
}>()
const form = defineModel<AccountCreateDraft>('form', {required: true})
const touched = defineModel<AccountCreateTouched>('touched', {required: true})
const password = defineModel<string>('password', {required: true})
const passwordTouched = defineModel<boolean>('passwordTouched', {required: true})
const emit = defineEmits<{ close: []; submit: [] }>()
</script>
<template>
  <AdminCommonDialog :open="open" title="新增账号"
                     description="填写账号资料并设置初始密码。创建后，请继续分配角色；使用者首次登录时必须修改密码。"
                     :busy="busy" @close="emit('close')">
    <form id="admin-create-user" class="admin-fields account-create-form" @submit.prevent="emit('submit')">
      <label><span class="account-field-label">用户名 <span class="account-required" aria-hidden="true">*</span>（创建后不可修改）</span>
        <UInput v-model="form.username" :disabled="busy" required :maxlength="64" autocomplete="off"
                :ui="{ base: 'admin-input' }" :aria-invalid="!!fieldErrors.username"
                aria-describedby="new-user-name-error" @blur="touched.username = true"/>
        <span id="new-user-name-error" class="admin-field-error" aria-live="polite">{{
            fieldErrors.username || '\u00a0'
          }}</span></label>
      <label><span class="account-field-label">显示名称 <span class="account-required"
                                                              aria-hidden="true">*</span></span>
        <UInput v-model="form.displayName" :disabled="busy" required :maxlength="80" :ui="{ base: 'admin-input' }"
                :aria-invalid="!!fieldErrors.displayName" aria-describedby="new-display-error"
                @blur="touched.displayName = true"/>
        <span id="new-display-error" class="admin-field-error" aria-live="polite">{{
            fieldErrors.displayName || '\u00a0'
          }}</span></label>
      <label>邮箱
        <UInput v-model="form.email" :disabled="busy" type="email" :maxlength="254" :ui="{ base: 'admin-input' }"
                :aria-invalid="!!fieldErrors.email" aria-describedby="new-email-error" @blur="touched.email = true"/>
        <span id="new-email-error" class="admin-field-error" aria-live="polite">{{
            fieldErrors.email || '\u00a0'
          }}</span></label>

      <ProfileFields :values="form" prefix="new-user" :disabled="busy" :errors="fieldErrors"
                     :department-options="catalog.departments.options" :position-options="catalog.positions.options"
                     :department-enabled="catalog.departments.enabled" :position-enabled="catalog.positions.enabled"
                     :catalog-hint="catalogPending ? '正在加载字典选项…' : catalogError ? '字典选项加载失败，请刷新后重试。' : '暂无选项，请先在数据字典中维护。'"
                     @update="(field, value) => { form[field] = value }" @blur="field => { touched[field] = true }"/>
      <AdminUsersInitialPasswordField id="new-user-password" v-model="password" class="account-full-width"
                                       :disabled="busy" :error="fieldErrors.password"
                                       @blur="passwordTouched = true"/>

      <AdminCommonFeedback v-if="error" class="account-full-width" tone="error">{{ error }}</AdminCommonFeedback>
    </form>
    <template #actions>
      <UButton class="admin-button" :disabled="busy" @click="emit('close')">取消</UButton>
      <UButton class="admin-button admin-button-primary" type="submit" form="admin-create-user" :disabled="busy">
        {{ busy ? '创建中…' : '创建账号' }}
      </UButton>
    </template>
  </AdminCommonDialog>
</template>
