<!-- 角色详情展示，交互由所属 composable 管理。 -->
<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import AuthorizationAssignment from './AuthorizationAssignment.vue'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {useRoleDetailsManagement} from '~/composables/admin/roles/useRoleDetailsManagement'
const {store,nameError,metadataDirty,withinScope,editable,role,form,submitError,warning,catalogError,canEdit,loadError,pending,busy,toast,confirmation,nameTouched,backTo,refreshCatalog,saveMetadata,ready}=useRoleDetailsManagement()
useHead(()=>({title:(editable.value?'编辑角色':'查看角色')+' | '+companyBrand.name}))
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-detail">
    <AdminCommonPageHeader :title="editable ? '编辑角色' : '查看角色'"
                           :description="editable ? '维护角色基本信息；先选择页面，再设置操作，页面与操作授权统一保存。' : '查看角色资料、操作权限与页面菜单；当前授权范围内无可编辑分区。'">
      <template #eyebrow>
        <AdminCommonBackLink :to="backTo">返回角色列表</AdminCommonBackLink>
      </template>
    </AdminCommonPageHeader>
    <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
    <AdminCommonDataState v-if="!role && pending" state="loading" title="正在加载角色…"/>
    <AdminCommonFeedback v-if="loadError" title="角色加载失败">{{ loadError }}</AdminCommonFeedback>
    <AdminCommonFeedback v-if="catalogError" title="权限目录加载失败">{{ catalogError }}
      <template #action>
        <UButton class="admin-button" :disabled="busy" @click="refreshCatalog()">重试权限目录</UButton>
      </template>
    </AdminCommonFeedback>
    <template v-if="role">
      <div class="admin-view-detail-grid">
        <aside class="admin-view-identity">
          <section class="admin-section admin-view-identity-card">
            <span class="admin-view-avatar admin-view-avatar-large"
                  aria-hidden="true">{{ role.name.trim().slice(0, 1).toUpperCase() }}</span>
            <h2 class="admin-view-identity-name">{{ role.name }}</h2>
            <p class="admin-view-username">{{ role.code }}</p>
            <div class="admin-view-badges">
              <AdminCommonStatusBadge :tone="role.enabled ? 'success' : 'neutral'">{{
                  role.enabled ? '启用' : '禁用'
                }}
              </AdminCommonStatusBadge>
            </div>
            <dl class="admin-view-audit">
              <div>
                <dt>角色 ID</dt>
                <dd>{{ role.id }}</dd>
              </div>
              <div>
                <dt>创建人 ID</dt>
                <dd>{{ role.createdBy ?? '系统初始化' }}</dd>
              </div>
              <div>
                <dt>创建时间</dt>
                <dd>{{ formatBeijingTime(role.createdAt) }}</dd>
              </div>
              <div>
                <dt>最近修改人 ID</dt>
                <dd>{{ role.updatedBy ?? '系统初始化' }}</dd>
              </div>
              <div>
                <dt>最近修改</dt>
                <dd>{{ formatBeijingTime(role.updatedAt) }}</dd>
              </div>
            </dl>
            <AdminCommonFeedback v-if="!withinScope" tone="info">此角色包含超出你授权范围的权限，仅可查看。
            </AdminCommonFeedback>
          </section>
        </aside>
        <div class="admin-view-detail-main">

          <section class="admin-section admin-view-panel">
            <h2>基本信息
              <AdminCommonDraftBadge v-if="canEdit('system.roles.update')" :dirty="metadataDirty"/>
            </h2>
            <p class="admin-view-section-description">{{
                canEdit('system.roles.update') ? '维护角色名称与启用状态；角色编码创建后不可修改。' : '查看角色名称、编码与启用状态。'
              }}</p>
            <form v-if="canEdit('system.roles.update')" class="admin-fields admin-view-profile-form"
                  @submit.prevent="saveMetadata">
              <label><span class="admin-view-field-label">角色名称 <span class="admin-view-required" aria-hidden="true">*</span></span>
                <UInput v-model="form.name" :disabled="busy" required :maxlength="80" :ui="{ base: 'admin-input' }"
                        :aria-invalid="!!nameError" aria-describedby="edit-name-error" @blur="nameTouched = true"/>
                <span id="edit-name-error" class="admin-field-error" aria-live="polite">{{
                    nameError || '\u00a0'
                  }}</span></label>
              <label>角色编码
                <UInput :model-value="role.code" disabled :ui="{ base: 'admin-input' }"/>
                <span class="admin-field-error" aria-hidden="true">&nbsp;</span></label>
              <div class="admin-view-status-row admin-view-full-width">
                <div><strong class="admin-view-status-title">{{ form.enabled ? '启用角色' : '禁用角色' }}</strong>
                  <p class="admin-view-status-description">
                    禁用后，该角色不再提供操作权限和导航授权；账号的其他有效角色不受影响。</p></div>
                <AdminCommonSwitchField v-model="form.enabled" label="启用角色" size="medium" :disabled="busy"/>
              </div>
              <AdminCommonFeedback v-if="submitError" class="admin-view-full-width" tone="error">{{
                  submitError
                }}
              </AdminCommonFeedback>
              <div class="admin-view-panel-actions">
                <UButton type="submit" class="admin-button admin-button-primary" :disabled="busy || !metadataDirty">
                  {{ busy ? '处理中…' : '保存基本信息' }}
                </UButton>
              </div>
            </form>
            <dl v-else class="admin-view-facts">
              <div>
                <dt>角色名称</dt>
                <dd>{{ role.name }}</dd>
              </div>
              <div>
                <dt>角色编码</dt>
                <dd>{{ role.code }}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{{ role.enabled ? '启用' : '禁用' }}</dd>
              </div>
            </dl>
          </section>
          <AuthorizationAssignment/>
        </div>
      </div>
    </template>
    <AdminCommonToast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.editor.feedback = null"/>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </section>
</template>

<style src="~/assets/admin/css/pages/roles.css"></style>
