<!-- 账号详情展示；分区操作和秘密输入生命周期由专属 composable 管理。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ProfileFields from './ProfileFields.vue'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import ResetPasswordDialog from './ResetPasswordDialog.vue'
import ActionConfirm from '~/components/admin/common/ConfirmDialog.vue'
import AccountToast from '~/components/admin/common/Toast.vue'
import {useUserDetailsManagement} from '~/composables/admin/users/useUserDetailsManagement'
const {store,profileCatalog,profileCatalogError,profileCatalogPending,canProfile,canRoles,canReset,canEdit,pageTitle,profileDirty,statusDirty,rolesDirty,roleOptions,assignedRoles,user,roles,roleError,rolesPending,form,selected,sectionErrors,touched,loadError,pending,warning,toast,isSelf,fieldErrors,busy,actionConfirm,backTo,resetOpen,password,passwordTouched,passwordError,refreshProfileCatalog,refreshRoleCatalog,closeReset,openReset,save,ready}=useUserDetailsManagement()
useHead(()=>({title:pageTitle.value+' | '+companyBrand.name}))
function actorLabel(actorId: string | null, name: string | null) {
  return actorId ? `${name || '操作者'}（ID：${actorId}）` : '系统初始化'
}

await ready
</script>
<template>
  <section class="admin-module account-page account-detail">
    <AdminCommonPageHeader :title="pageTitle"
                           :description="canEdit ? '资料、状态与角色分别保存；保存一个分区不会提交或丢弃其他分区的草稿。' : user?.isRoot ? '查看超级管理员账号资料、状态及系统级权限说明。' : '查看账号资料、状态及已分配角色。'">
      <template #eyebrow>
        <NuxtLink class="account-back-link" :to="backTo"><span aria-hidden="true">←</span> 返回账号列表</NuxtLink>
      </template>
    </AdminCommonPageHeader>
    <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
    <AdminCommonDataState v-if="!user && pending" state="loading" title="正在加载账号…"/>
    <AdminCommonFeedback v-if="loadError" title="账号加载失败">{{ loadError }}</AdminCommonFeedback>
    <template v-if="user">

      <div class="account-detail-grid">
        <aside class="account-identity">
          <section class="admin-section admin-summary account-identity-card">
            <span class="account-avatar account-avatar-large"
                  aria-hidden="true">{{ user.displayName.trim().slice(0, 1).toUpperCase() }}</span>
            <h2 class="account-identity-name">{{ user.displayName }}</h2>
            <p class="account-username">@{{ user.username }}</p>
            <div class="account-badges">
              <AdminCommonStatusBadge :tone="user.enabled ? 'success' : 'neutral'">{{
                  user.enabled ? '启用' : '禁用'
                }}
              </AdminCommonStatusBadge>
              <AdminCommonStatusBadge v-if="user.isRoot">超级管理员</AdminCommonStatusBadge>
              <AdminCommonStatusBadge v-if="user.mustChangePassword" tone="warning">待首次改密</AdminCommonStatusBadge>
            </div>
            <dl class="account-audit">
              <div>
                <dt>会话状态</dt>
                <dd>{{ user.activeSessionCount ? '有有效会话（' + user.activeSessionCount + '）' : '无有效会话' }}</dd>
              </div>
              <div>
                <dt>最近登录</dt>
                <dd>{{ user.lastLoginAt ? formatBeijingTime(user.lastLoginAt) : '暂无登录记录' }}</dd>
              </div>
              <div v-if="user.lastActivityAt">
                <dt>最近会话活动</dt>
                <dd>{{ formatBeijingTime(user.lastActivityAt) }}</dd>
              </div>
              <div>
                <dt>账号 ID</dt>
                <dd>{{ user.id }}</dd>
              </div>
              <div>
                <dt>创建人</dt>
                <dd>{{ actorLabel(user.createdBy, user.createdByName) }}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{{ formatBeijingTime(user.createdAt) }}</dd>
              </div>
              <div>
                <dt>最近修改人</dt>
                <dd>{{ actorLabel(user.updatedBy, user.updatedByName) }}</dd>
              </div>
              <div>
                <dt>最近修改</dt>
                <dd>{{ formatBeijingTime(user.updatedAt) }}</dd>
              </div>
            </dl>
            <AdminCommonFeedback v-if="user.isRoot" tone="info">
              超级管理员仅可查看；不通过普通账号入口修改、分配角色、重置密码或删除。
            </AdminCommonFeedback>
            <AdminCommonFeedback v-else-if="isSelf" tone="info">
              本人账号在此仅供查看。修改个人资料或密码，请使用顶部用户菜单。
            </AdminCommonFeedback>
            <AdminCommonFeedback v-else-if="!user.manageable" tone="info">该账号角色超出你的权限或菜单范围，仅可查看。
            </AdminCommonFeedback>
            <AdminCommonFeedback v-else-if="!canEdit" tone="info">当前权限仅允许查看账号。</AdminCommonFeedback>
          </section>
        </aside>
        <div class="account-detail-main">
          <section class="admin-section account-panel">
            <h2>基本信息 <small v-if="canProfile" class="account-save-state"
                                :class="{ 'account-save-state-dirty': profileDirty }">{{
                profileDirty ? '有未保存修改' : '无未保存修改'
              }}</small></h2>
            <p class="account-section-description">{{
                canProfile ? '维护显示名称、联系方式、部门、岗位及管理备注。' : '查看显示名称、联系方式、部门、岗位及管理备注。'
              }}</p>
            <form v-if="canProfile" class="admin-fields account-profile-form" @submit.prevent="save('profile')">
              <AdminCommonFeedback v-if="profileCatalogError" class="account-full-width" tone="warning">
                部门或岗位字典加载失败，相关字段暂不可新增选择。{{ profileCatalogError }}
                <template #action>
                  <UButton class="admin-button" :disabled="busy || profileCatalogPending"
                           @click="refreshProfileCatalog()">重试字典
                  </UButton>
                </template>
              </AdminCommonFeedback>
              <label><span class="account-field-label">显示名称 <span class="account-required"
                                                                      aria-hidden="true">*</span></span>
                <UInput v-model="form.displayName" :disabled="busy" required :maxlength="80"
                        :ui="{ base: 'admin-input' }" :aria-invalid="!!fieldErrors.displayName"
                        aria-describedby="edit-user-name-error" @blur="touched.displayName = true"/>
                <span id="edit-user-name-error" class="admin-field-error"
                      aria-live="polite">{{ fieldErrors.displayName || '\u00a0' }}</span></label>
              <label>邮箱
                <UInput v-model="form.email" type="email" :disabled="busy" :maxlength="254"
                        :ui="{ base: 'admin-input' }" :aria-invalid="!!fieldErrors.email"
                        aria-describedby="edit-user-email-error" @blur="touched.email = true"/>
                <span id="edit-user-email-error" class="admin-field-error"
                      aria-live="polite">{{ fieldErrors.email || '\u00a0' }}</span></label>
              <ProfileFields :values="form" prefix="edit-user" :disabled="busy" :errors="fieldErrors"
                             :department-options="profileCatalog.departments.options"
                             :position-options="profileCatalog.positions.options"
                             :department-enabled="profileCatalog.departments.enabled"
                             :position-enabled="profileCatalog.positions.enabled"
                             :catalog-hint="profileCatalogPending ? '正在加载字典选项…' : profileCatalogError ? '暂无可用选项，请刷新后重试。' : '暂无选项，请先在数据字典中维护。'"
                             @update="(field, value) => { form[field] = value }"
                             @blur="field => { touched[field] = true }"/>
              <AdminCommonFeedback v-if="sectionErrors.profile" class="account-full-width" tone="error">
                {{ sectionErrors.profile }}
              </AdminCommonFeedback>
              <div class="account-panel-actions">
                <UButton type="submit" class="admin-button admin-button-primary" :disabled="busy || !profileDirty">
                  {{ busy ? '处理中…' : '保存基本信息' }}
                </UButton>
              </div>
            </form>
            <dl v-else class="account-facts">
              <div>
                <dt>显示名称</dt>
                <dd>{{ user.displayName }}</dd>
              </div>
              <div>
                <dt>邮箱</dt>
                <dd>{{ user.email || '—' }}</dd>
              </div>
              <ProfileFields :values="user" prefix="view-user" readonly
                             :department-options="profileCatalog.departments.options"
                             :position-options="profileCatalog.positions.options"
                             :department-enabled="profileCatalog.departments.enabled"
                             :position-enabled="profileCatalog.positions.enabled"/>
            </dl>

          </section>
          <section class="admin-section account-panel"><h2>账号状态 <small v-if="canProfile && !isSelf"
                                                                           class="account-save-state"
                                                                           :class="{ 'account-save-state-dirty': statusDirty }">{{
              statusDirty ? '有未保存修改' : '无未保存修改'
            }}</small></h2>
            <form v-if="canProfile && !isSelf" class="account-status-form" @submit.prevent="save('status')">
              <div class="account-status-row">
                <div><strong class="account-status-title">{{ form.enabled ? '账号已启用' : '账号已禁用' }}</strong>
                  <p id="account-status-help" class="account-status-description">
                    禁用后无法登录，已登录的用户会立即退出；资料与角色分配保留，可重新启用。</p></div>
                <AdminCommonSwitchField v-model="form.enabled" size="medium" label="启用账号"
                                        aria-describedby="account-status-help" :disabled="busy"/>
              </div>
              <AdminCommonFeedback v-if="sectionErrors.status" tone="error">{{
                  sectionErrors.status
                }}
              </AdminCommonFeedback>
              <div class="account-panel-actions">
                <UButton type="submit" class="admin-button admin-button-primary" :disabled="busy || !statusDirty">
                  {{ busy ? '处理中…' : '保存账号状态' }}
                </UButton>
              </div>
            </form>
            <div v-else class="account-status-row">
              <div><strong class="account-status-title">当前账号状态</strong>
                <p class="account-status-description">{{
                    isSelf ? '不能修改自己的账号状态。' : '当前账号状态仅供查看。'
                  }}</p></div>
              <AdminCommonStatusBadge :tone="user.enabled ? 'success' : 'neutral'">{{
                  user.enabled ? '启用' : '禁用'
                }}
              </AdminCommonStatusBadge>
            </div>

          </section>
          <section v-if="user.isRoot" class="admin-section account-panel">
            <h2>系统级权限</h2>
            <p class="admin-help">此账号为系统保留的超级管理员，不参与普通角色分配，其权限由系统内部控制。</p>
          </section>
          <section v-else class="admin-section account-panel">
            <h2>{{ canRoles ? '角色分配' : '已分配角色' }} <small v-if="canRoles" class="account-save-state"
                                                                  :class="{ 'account-save-state-dirty': rolesDirty }">{{
                selected.length
              }} 项已选 · {{ rolesDirty ? '有未保存修改' : '无未保存修改' }}</small></h2>
            <AdminCommonFeedback v-if="roleError" title="角色目录加载失败">{{ roleError }}
              <template #action>
                <UButton class="admin-button" :disabled="busy || rolesPending" @click="refreshRoleCatalog()">
                  重试角色目录
                </UButton>
              </template>
            </AdminCommonFeedback>
            <p v-if="canRoles" class="admin-help">
              支持多角色，须单独保存。禁用或超出自身范围的角色不可新增分配；清空角色不会删除账号。</p>
            <div v-if="canRoles" class="admin-check-list account-role-grid"><label v-for="role in roleOptions"
                                                                                   :key="role.id"
                                                                                   class="admin-permission account-role-card"
                                                                                   :class="{ 'account-role-selected': selected.includes(role.id), 'account-role-disabled': !role.grantable && !selected.includes(role.id) }"><input
                v-model="selected" type="checkbox" :value="role.id"
                :disabled="busy || rolesPending || !!roleError || (!role.grantable && !selected.includes(role.id))"><span
                class="account-role-copy"><strong>{{
                role.name
              }}</strong><small>{{
                !role.enabled ? '已禁用 · 仅可保留或移除已有分配' : role.grantable ? '可分配角色' : '超出可分配范围'
              }}</small></span></label></div>
            <ul v-else-if="assignedRoles.length" class="account-assigned-roles">
              <li v-for="role in assignedRoles" :key="role.id">{{ role.name }}{{ role.enabled ? '' : '（禁用）' }}</li>
            </ul>
            <p v-if="!(canRoles ? roleOptions.length : assignedRoles.length)" class="admin-help">
              {{ canRoles ? '暂无可分配角色，请联系角色管理员维护。' : '尚未分配角色。' }}</p>
            <AdminCommonFeedback v-if="sectionErrors.roles" tone="error">{{ sectionErrors.roles }}</AdminCommonFeedback>
            <div v-if="canRoles" class="account-panel-actions">
              <UButton class="admin-button admin-button-primary"
                       :disabled="busy || rolesPending || !!roleError || !roles || !rolesDirty" @click="save('roles')">
                {{ busy ? '处理中…' : '保存角色分配' }}
              </UButton>
            </div>

          </section>
          <section v-if="canReset" class="admin-section account-panel account-danger-panel"><h2>安全操作</h2>
            <div class="account-security-row"><p>
              密码重置会撤销全部会话，并要求下次登录改密。本人密码请使用顶部用户菜单。</p>
              <UButton v-if="canReset" class="admin-button admin-button-danger" :disabled="busy"
                       @click="openReset">
                重置密码
              </UButton>
            </div>
          </section>
        </div>
      </div>
    </template>
    <ResetPasswordDialog v-model="password" :open="resetOpen" :username="user?.username ?? ''" :busy="busy"
                         :can-reset="canReset" :error="passwordError" @close="closeReset" @blur="passwordTouched = true"
                         @submit="save('password')"/>
    <AccountToast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.clearFeedback('editor')"/>
    <ActionConfirm :confirmation="actionConfirm.state.value" @settle="actionConfirm.settle"/>
  </section>
</template>
<style src="~/assets/admin/css/pages/users.css"></style>
