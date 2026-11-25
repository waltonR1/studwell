<!-- DictionaryTypeForm：消费所属业务状态，不独立请求或复制草稿。 -->
<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {useAdminDictionariesStore} from '~/stores/admin/dictionaries'

const emit = defineEmits<{save: []}>()
const store = useAdminDictionariesStore()
const {editor, createMode, canUpdateType, typeEditable, fieldErrors} = storeToRefs(store)
const {typeForm, typeTouched: touched, typeError, busy} = toRefs(editor.value)
</script>
<template>
  <form id="dictionary-type-form" class="admin-fields dictionary-type-form" @submit.prevent="emit('save')">
    <label><span class="admin-view-field-label">字典编码 <span class="admin-view-required"
                                                               aria-hidden="true">*</span></span>
      <UInput v-model="typeForm.code" :disabled="busy || !createMode" required :maxlength="64"
              :ui="{ base: 'admin-input' }" :aria-invalid="!!fieldErrors.code" aria-describedby="dictionary-type-code"
              @blur="touched.code = true"/>
      <span id="dictionary-type-code" class="admin-field-error" aria-live="polite">{{
          fieldErrors.code || '\u00a0'
        }}</span></label>
    <label><span class="admin-view-field-label">显示名称 <span class="admin-view-required"
                                                               aria-hidden="true">*</span></span>
      <UInput v-model="typeForm.name" :disabled="busy || (!createMode && !canUpdateType)" required :maxlength="80"
              :ui="{ base: 'admin-input' }" :aria-invalid="!!fieldErrors.name" aria-describedby="dictionary-type-name"
              @blur="touched.name = true"/>
      <span id="dictionary-type-name" class="admin-field-error" aria-live="polite">{{
          fieldErrors.name || '\u00a0'
        }}</span></label>
    <label class="dictionary-full-width"><span class="admin-view-field-label">用途说明</span>
      <UInput v-model="typeForm.description" :disabled="busy || (!createMode && !canUpdateType)" :maxlength="300"
              placeholder="说明所属业务模块、使用场景及停用影响" :ui="{ base: 'admin-input' }"
              :aria-invalid="!!fieldErrors.description" aria-describedby="dictionary-type-description"
              @blur="touched.description = true"/>
      <span id="dictionary-type-description" class="admin-field-error"
            aria-live="polite">{{ fieldErrors.description || '\u00a0' }}</span></label>
    <div class="dictionary-status-row dictionary-full-width">
      <div><strong>{{ typeForm.enabled ? '启用字典' : '停用字典' }}</strong>
        <p>停用后业务不再返回新选项；已有记录、选项和编码保持不变。</p></div>
      <AdminCommonSwitchField v-model="typeForm.enabled" label="启用字典" size="medium"
                              :disabled="busy || !typeEditable"/>
    </div>
    <AdminCommonFeedback v-if="typeError" class="dictionary-full-width" tone="error">{{
        typeError
      }}
    </AdminCommonFeedback>
  </form>
</template>
