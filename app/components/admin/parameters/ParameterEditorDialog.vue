<!-- ParameterEditorDialog：消费所属业务状态，不独立请求或复制草稿。 -->
<script setup lang="ts">
import SwitchField from '~/components/admin/common/SwitchField.vue'
import SelectField from '~/components/admin/common/SelectField.vue'
import {parameterGroups} from '~/config/admin/parameters'
import {storeToRefs} from 'pinia'
import {useAdminParametersStore} from '~/stores/admin/parameters'
import type {ParameterGroup} from '#shared/types/admin/parameters'

const emit = defineEmits<{
  close: [];
  save: [group: ParameterGroup, reset?: boolean]
}>()
const store = useAdminParametersStore()
const {
  busy,
  submitError,
  open,
  draft,
  editorRows,
  editorGroup,
  editorTitle,
  editorEditable
} = storeToRefs(store)
const {changed, canEdit, invalid} = store
</script>
<template>
  <AdminCommonDialog size="medium" :open="open" :title="(editorEditable ? '编辑' : '查看') + editorTitle"
                     :description="parameterGroups.find(group => group.key === editorGroup)?.description" :busy="busy"
                     @close="emit('close')">
    <form id="parameter-edit-form" class="parameter-edit-form" @submit.prevent="emit('save', editorGroup)">
      <div class="parameter-grid">
        <div v-for="row in editorRows" :key="row.id" class="parameter-field">
          <label :for="'parameter-' + row.id">{{ row.name }}</label>
          <div class="parameter-control">
            <template v-if="row.type === 'boolean'">
              <SwitchField :model-value="Boolean(draft[row.id])" :label="row.name" :disabled="busy || !canEdit(row)"
                           @update:model-value="draft[row.id] = $event"/>
              <span>{{ draft[row.id] ? '开启' : '关闭' }}</span></template>
            <SelectField v-else-if="row.allowedValues.length" :model-value="String(draft[row.id])" :label="row.name"
                         :items="row.allowedValues.map(value => ({ value: String(value), label: String(value) + ' ' + row.unit }))"
                         :disabled="busy || !canEdit(row)" :body-lock="false"
                         @update:model-value="draft[row.id] = $event"/>
            <template v-else><input :id="'parameter-' + row.id" :value="draft[row.id]" class="admin-input" type="number"
                                    step="1" :min="row.min" :max="row.max" :disabled="busy || !canEdit(row)"
                                    :aria-invalid="invalid(row)"
                                    @input="draft[row.id] = ($event.target as HTMLInputElement).value"><span>{{
                row.unit
              }}</span></template>
          </div>
          <p v-if="row.description" class="parameter-help">{{ row.description }}</p>
          <p class="parameter-meta">
            默认：{{ row.type === 'boolean' ? (row.defaultValue ? '开启' : '关闭') : row.defaultValue }} {{
              row.unit
            }}<span v-if="row.type === 'number' && !row.allowedValues.length"> · 范围 {{ row.min }}–{{ row.max }}</span>
            · {{ row.override === null ? '使用默认值' : '自定义值' }}</p>
          <p class="parameter-meta">{{ row.effect }} · {{ row.consumers }}</p>
          <p class="admin-field-error" aria-live="polite">{{ row.invalidOverride ? '已存配置无效，当前已回退默认值，请修正或恢复默认。' : invalid(row) ? '请输入允许范围内的整数。' : '' }}</p>
          <div class="parameter-definition"><p>参数编码：{{ row.key }}</p>
            <p>最后修改人：{{ row.updatedBy ?? '初始化' }}</p></div>
        </div>
      </div>

      <AdminCommonFeedback v-if="submitError" tone="error">{{ submitError }}</AdminCommonFeedback>
    </form>
    <template #actions>
      <UButton class="admin-button" :disabled="busy" @click="emit('close')">{{ editorEditable ? '取消' : '关闭' }}</UButton>
      <template v-if="editorEditable">
        <UButton class="admin-button"
                 :disabled="busy || !editorRows.some(row => row.override !== null || row.invalidOverride || changed(row))"
                 @click="emit('save', editorGroup, true)">恢复默认
        </UButton>
        <UButton type="submit" form="parameter-edit-form" class="admin-button admin-button-primary"
                 :disabled="busy || !editorRows.some(row => changed(row) || row.invalidOverride)">保存
        </UButton>
      </template>
    </template>
  </AdminCommonDialog>
</template>
