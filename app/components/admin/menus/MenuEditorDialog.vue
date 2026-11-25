<!-- MenuEditorDialog：消费所属业务状态，不独立请求或复制草稿。 -->
<script setup lang="ts">
import IconPicker from './IconPicker.vue'
import {describeMenu} from '~/utils/admin/menus/tree'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {storeToRefs} from 'pinia'
import {useAdminMenusStore} from '~/stores/admin/menus'

const emit = defineEmits<{close: []; save: []}>()
const store = useAdminMenusStore()
const {
  menus,
  busy,
  dirty,
  writable,
  fieldErrors,
  pageOptions,
  parentOptions
} = storeToRefs(store)
const {open, editing, form, touched, error} = toRefs(store.editor)
const hideReason=computed(()=>form.value.visible ? undefined : editing.value?.hideDisabledReason)
</script>
<template>
  <AdminCommonDialog :open="open" :title="editing ? (writable ? '编辑菜单' : '查看菜单') : '新增菜单'"
                     description="编码唯一且创建后不可修改。固定功能仅能绑定一次；通用网页维护可重复绑定，按编码区分入口。显示开关不代表内容发布。"
                     :busy="busy" @close="emit('close')">
    <form id="admin-menu-form" class="admin-fields admin-view-create-form" @submit.prevent="emit('save')">
      <label><span class="admin-view-field-label">名称 <span class="admin-view-required"
                                                             aria-hidden="true">*</span></span>
        <UInput v-model="form.name" :disabled="busy || !writable" :maxlength="80" required
                :aria-invalid="!!fieldErrors.name" aria-describedby="menu-name-error" :ui="{ base: 'admin-input' }"
                @blur="touched.name = true"/>
        <span id="menu-name-error" class="admin-field-error" aria-live="polite">{{
            fieldErrors.name
          }}</span></label>
      <label><span class="admin-view-field-label">编码 <span class="admin-view-required" aria-hidden="true">*</span>（创建后不可修改）</span>
        <UInput v-model="form.code" :disabled="busy || !writable || !!editing" :maxlength="64" required
                :aria-invalid="!!fieldErrors.code" aria-describedby="menu-code-error" :ui="{ base: 'admin-input' }"
                @blur="touched.code = true"/>
        <span id="menu-code-error" class="admin-field-error" aria-live="polite">{{
            fieldErrors.code
          }}</span></label>
      <label><span class="admin-view-field-label">类型 / 页面绑定 <span class="admin-view-required"
                                                                        aria-hidden="true">*</span>（创建后不可修改）</span>
        <AdminCommonSelectField v-model="form.pageKey" label="类型或页面绑定" :disabled="busy || !writable || !!editing"
                                :items="pageOptions"/>
      </label>
      <label><span class="admin-view-field-label">父级目录 <span class="admin-view-required" aria-hidden="true">*</span></span>
        <AdminCommonSelectField v-model="form.parentId" label="父级目录" :disabled="busy || !writable"
                                :items="[{ label: '顶层', value: '' }, ...parentOptions.map(parent => ({ label: describeMenu(parent, menus ?? []).path, value: parent.id }))]"/>
      </label>
      <AdminCommonFeedback v-if="hideReason" class="admin-view-full-width" tone="warning">{{ hideReason }}</AdminCommonFeedback>
      <AdminCommonFeedback v-if="error" class="admin-view-full-width" tone="error">{{ error }}</AdminCommonFeedback>
      <IconPicker v-model="form.iconKey" class="admin-view-full-width" :disabled="busy || !writable"
                  :error="fieldErrors.iconKey"/>
      <div class="admin-view-status-row admin-view-full-width">
        <div><strong class="admin-view-status-title">在导航中显示</strong>
          <p class="admin-view-status-description">已发布的官网页面及其上级菜单需先下线内容才能隐藏。</p></div>
        <AdminCommonTooltip :text="form.visible ? editing?.hideDisabledReason : undefined" :disabled-target="!!(form.visible && editing?.hideDisabledReason)"><AdminCommonSwitchField v-model="form.visible" label="在导航中显示" size="medium"
                                :disabled="busy || !writable || !!(form.visible && editing?.hideDisabledReason)"/></AdminCommonTooltip>
      </div>
      <p v-if="editing" class="admin-meta admin-view-full-width">创建人 ID：{{ editing.createdBy ?? '初始化记录' }} ·
        {{ formatBeijingTime(editing.createdAt) }}<br>修改人 ID：{{ editing.updatedBy ?? '初始化记录' }} ·
        {{ formatBeijingTime(editing.updatedAt) }}</p>
    </form>
    <template #actions>
      <UButton class="admin-button" :disabled="busy" @click="emit('close')">{{ dirty ? '取消' : '关闭' }}</UButton>
      <UButton v-if="writable" class="admin-button admin-button-primary" type="submit" form="admin-menu-form"
               :disabled="busy || !dirty || !!hideReason">{{ busy ? '保存中…' : '保存菜单' }}
      </UButton>
    </template>
  </AdminCommonDialog>
</template>
