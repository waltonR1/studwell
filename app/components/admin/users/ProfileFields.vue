<script setup lang="ts">
import {dictionaryItems, dictionaryLabel} from '~/utils/admin/users/profile-options'
import type {AccountCreateDraft} from '~/types/admin/users'
import type {AccountDictionaryOption} from '#shared/types/admin/dictionaries'

type Field = 'phone' | 'department' | 'position' | 'remark'
const props = withDefaults(defineProps<{
  values: Pick<AccountCreateDraft, Field> | Record<Field, string | null>
  prefix: string
  disabled?: boolean
  readonly?: boolean
  errors?: Record<string, string>
  departmentOptions?: AccountDictionaryOption[]
  positionOptions?: AccountDictionaryOption[]
  departmentEnabled?: boolean
  positionEnabled?: boolean
  includePhone?: boolean
  includeRemark?: boolean
  catalogHint?: string
}>(), {
  errors: () => ({}),
  departmentOptions: () => [],
  positionOptions: () => [],
  departmentEnabled: true,
  positionEnabled: true,
  includePhone: true,
  includeRemark: true,
  catalogHint: ''
})
const emit = defineEmits<{ update: [field: Field, value: string]; blur: [field: Field] }>()
const departmentItems = computed(() => dictionaryItems('department', props.departmentOptions, props.values.department, props.departmentEnabled))
const positionItems = computed(() => dictionaryItems('position', props.positionOptions, props.values.position, props.positionEnabled))

const noDepartmentOptions = computed(() => !props.departmentEnabled || !props.departmentOptions.some(option => option.enabled))
const noPositionOptions = computed(() => !props.positionEnabled || !props.positionOptions.some(option => option.enabled))
</script>
<template>
  <template v-if="readonly">
    <div v-if="includePhone">
      <dt>联系电话</dt>
      <dd>{{ values.phone || '—' }}</dd>
    </div>
    <div>
      <dt>所属部门</dt>
      <dd>{{ dictionaryLabel(departmentOptions, values.department) }}</dd>
    </div>
    <div>
      <dt>职务／岗位</dt>
      <dd>{{ dictionaryLabel(positionOptions, values.position) }}</dd>
    </div>
    <div v-if="includeRemark">
      <dt>管理备注</dt>
      <dd class="account-remark-text">{{ values.remark || '—' }}</dd>
    </div>
  </template>
  <template v-else>
    <label v-if="includePhone">
      <span class="account-field-label">联系电话</span>
      <UInput :model-value="values.phone ?? ''" type="tel" :disabled="disabled" :maxlength="32"
              :ui="{ base: 'admin-input' }" :aria-invalid="!!errors.phone" :aria-describedby="prefix + '-phone-error'"
              @update:model-value="emit('update', 'phone', String($event))" @blur="emit('blur', 'phone')"/>
      <span :id="prefix + '-phone-error'" class="admin-field-error" aria-live="polite">{{
          errors.phone || '\u00a0'
        }}</span>
    </label>
    <label>
      <span class="account-field-label">所属部门</span>
      <AdminCommonSelectField :model-value="values.department ?? ''" :items="departmentItems" label="所属部门"
                              :disabled="disabled || (noDepartmentOptions && !values.department)"
                              @update:model-value="emit('update', 'department', $event)"
                              @change="emit('blur', 'department')"/>
      <span :id="prefix + '-department-error'" class="admin-field-error"
            aria-live="polite">{{ errors.department || (noDepartmentOptions ? catalogHint : '') || '\u00a0' }}</span>
    </label>
    <label>
      <span class="account-field-label">职务／岗位</span>
      <AdminCommonSelectField :model-value="values.position ?? ''" :items="positionItems" label="职务／岗位"
                              :disabled="disabled || (noPositionOptions && !values.position)"
                              @update:model-value="emit('update', 'position', $event)"
                              @change="emit('blur', 'position')"/>
      <span :id="prefix + '-position-error'" class="admin-field-error"
            aria-live="polite">{{ errors.position || (noPositionOptions ? catalogHint : '') || '\u00a0' }}</span>
    </label>
    <label v-if="includeRemark" class="account-full-width">
      <span class="account-field-label">管理备注</span>
      <textarea :value="values.remark ?? ''" class="admin-input account-remark" rows="3" :disabled="disabled"
                :maxlength="500" :aria-invalid="!!errors.remark" :aria-describedby="prefix + '-remark-error'"
                @input="emit('update', 'remark', ($event.target as HTMLTextAreaElement).value)"
                @blur="emit('blur', 'remark')"/>
      <span :id="prefix + '-remark-error'" class="admin-field-error" aria-live="polite">{{
          errors.remark || '\u00a0'
        }}</span>
    </label>
  </template>
</template>
