<script setup lang="ts">
import ProfileFields from '~/components/admin/users/ProfileFields.vue'
import {useAdminUsersStore} from '~/stores/admin/users'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
const store = useAdminUsersStore(), auth = useAdminSessionStore(), route = useRoute()
const {data, pending, error, form, submitError, warning, fieldErrors, feedback: notification} = toRefs(store.personal)
const dirty = computed(() => store.personalDirty)
const busy = useAdminBusy(() => store.personal.busy)
const unsaved = useAdminUnsavedGuard(dirty, '未保存的个人资料将丢失，确定放弃修改？')
const save = store.savePersonal
async function refresh() { await store.refreshPersonal().catch(() => {}) }
useAdminRefresh(() => store.refreshPersonal(), () => unsaved.guard())
onBeforeUnmount(() => store.leavePersonal())
await callOnce('admin-personal-profile:' + auth.generation + ':' + route.fullPath, () => store.loadPersonal(), {mode: 'navigation'})
</script>
<template>
  <section class="admin-module account-page account-detail">
    <AdminCommonPageHeader title="个人资料" description="维护本人的显示名称、联系方式、所属部门和职务／岗位。"/>
    <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
    <AdminCommonDataState v-if="pending && !data" state="loading" title="正在加载个人资料…"/>
    <AdminCommonDataState v-else-if="error && !data" state="error" title="个人资料加载失败"
                          :description="error">
      <template #action>
        <UButton class="admin-button" @click="refresh()">重试</UButton>
      </template>
    </AdminCommonDataState>
    <section v-else-if="data" class="admin-section account-panel">
      <h2>基本信息</h2>
      <AdminCommonFeedback v-if="data.isRoot" tone="info">系统保留的超级管理员资料仅供查看。</AdminCommonFeedback>
      <dl class="account-facts">
        <div>
          <dt>用户名</dt>
          <dd>{{ data.username }}</dd>
        </div>
      </dl>
      <form class="admin-fields account-profile-form" @submit.prevent="save">
        <label><span>显示名称 <span class="account-required">*</span></span>
          <UInput v-model="form.displayName" required :maxlength="80" :disabled="busy || data.isRoot"
                  :ui="{ base: 'admin-input' }"/>
          <span class="admin-field-error">{{ fieldErrors.displayName || '\u00a0' }}</span></label>
        <label>邮箱
          <UInput v-model="form.email" type="email" :maxlength="254" :disabled="busy || data.isRoot"
                  :ui="{ base: 'admin-input' }"/>
          <span class="admin-field-error">{{ fieldErrors.email || '\u00a0' }}</span></label>
        <label>联系电话
          <UInput v-model="form.phone" type="tel" :maxlength="32" :disabled="busy || data.isRoot"
                  :ui="{ base: 'admin-input' }"/>
          <span class="admin-field-error">{{ fieldErrors.phone || '\u00a0' }}</span></label>
        <ProfileFields
            :values="{ phone: form.phone, department: form.department, position: form.position, remark: null }"
            prefix="profile" :disabled="busy || data.isRoot" :errors="fieldErrors" :include-phone="false"
            :include-remark="false" :department-options="data.dictionaryCatalog.departments.options"
            :position-options="data.dictionaryCatalog.positions.options"
            :department-enabled="data.dictionaryCatalog.departments.enabled"
            :position-enabled="data.dictionaryCatalog.positions.enabled"
            catalog-hint="暂无选项，请联系管理员维护数据字典。"
            @update="(field, value) => { if (field === 'department' || field === 'position') form[field] = value }"/>
        <AdminCommonFeedback v-if="submitError" class="account-full-width" tone="error">{{
            submitError
          }}
        </AdminCommonFeedback>
        <div v-if="!data.isRoot" class="account-panel-actions">
          <UButton type="submit" class="admin-button admin-button-primary" :disabled="busy || !dirty">
            {{ busy ? '保存中…' : '保存个人资料' }}
          </UButton>
        </div>
      </form>
    </section>
    <AdminCommonToast :notification="notification?{message:notification.message,tone:notification.status}:null" @dismiss="notification = null"/>
  </section>
</template>
<style src="~/assets/admin/css/pages/users.css"></style>
