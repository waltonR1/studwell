<!-- 账号列表与创建弹窗展示，交互和秘密输入生命周期由专属 composable 管理。 -->
<script setup lang="ts">
import {adminEnabledStatusOptions} from '~/config/admin/list'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import CreateDialog from './CreateDialog.vue'
import {Plus,Search,Trash2,ArrowUpRight,Eye} from 'lucide-vue-next'
import SelectField from '~/components/admin/common/SelectField.vue'
import AccountToast from '~/components/admin/common/Toast.vue'
import ActionConfirm from '~/components/admin/common/ConfirmDialog.vue'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useUsersListManagement} from '~/composables/admin/users/useUsersListManagement'
const auth=useAdminSessionStore(),preferenceState=useAdminPreferencesStore(),pageRoute=useRoute()
const actorId=auth.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${auth.generation}:${actorId}:${pageRoute.path}`,()=>preferenceState.load(actorId),{mode:'navigation'})
const {session,route,store,listQuery,search,status,pageSize,page,profileCatalog,profileCatalogError,profileCatalogPending,create,canEditRow,canToggle,form,touched,error,data,loadError,pending,busy,toggling,warning,toast,actionConfirm,createOpen,createPassword,passwordTouched,fieldErrors,clearCreate,closeCreate,submitCreate,retryList,toggleEnabled,remove,ready}=useUsersListManagement()
await ready
</script>
<template>
  <section class="admin-module account-page account-list">
    <AdminCommonPageHeader title="账号管理"
                           description="维护账号资料、状态和角色分配；超级管理员与本人高风险操作由服务端保护。"/>
    <section class="account-list-card" aria-label="账号查询结果">
      <header class="account-list-heading"><h2>账号列表 <span v-if="data" class="account-result-count">{{ data.total }} 条</span>
      </h2>
        <p>管理后台访问账号与登录状态</p></header>
      <form class="admin-toolbar admin-filter-bar account-filters" @submit.prevent="listQuery.submitSearch">
        <div class="account-search">
          <Search class="account-search-icon" aria-hidden="true"/>
          <UInput v-model="search" aria-label="用户名或显示名称" placeholder="搜索用户名或显示名称" :maxlength="100"
                  :ui="{ base: 'admin-input' }"/>
        </div>
        <SelectField v-model="status" label="账号状态筛选"
                     :items="adminEnabledStatusOptions"
                     @change="listQuery.applyFilter"/>
        <UButton class="admin-button" type="submit">查询</UButton>
        <UButton type="button" v-if="auth.can('system.users.create')"
                 class="admin-button admin-button-primary account-create-button" :disabled="busy"
                 @click="clearCreate">
          <Plus class="account-button-icon" aria-hidden="true"/>
          新增账号
        </UButton>
      </form>
      <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}
        <template v-if="create.createdAccount && auth.can('system.users.read')" #action>
          <NuxtLink class="admin-button"
                    :to="{ path: `/admin/users/${create.createdAccount.id}`, query: { returnTo: route.fullPath } }">继续查看账号
          </NuxtLink>
        </template>
        <template v-else #action>
          <UButton class="admin-button" :disabled="busy || pending" @click="retryList">刷新列表</UButton>
        </template>
      </AdminCommonFeedback>
      <AdminCommonDataState v-if="pending" state="loading" title="正在加载账号…"/>
      <AdminCommonDataState v-else-if="loadError" state="error" title="账号列表加载失败"
                            :description="loadError">
        <template #action>
          <UButton class="admin-button" @click="retryList">重试</UButton>
        </template>
      </AdminCommonDataState>
      <AdminCommonDataState v-else-if="data && !data.items.length" state="empty" title="暂无账号"
                            description="当前筛选条件下没有账号。"/>
      <AdminCommonTable v-else-if="data" label="账号列表" :min-width="900">
        <colgroup>
          <col class="account-col-identity">
          <col class="account-col-roles">
          <col class="account-col-status">
          <col class="account-col-time">
          <col class="account-col-actions">
        </colgroup>
        <thead>
        <tr>
          <th>账号</th>
          <th>角色</th>
          <th class="admin-table-status">状态</th>
          <th>最近登录</th>
          <th class="admin-table-actions">操作</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="row in data.items" :key="row.id">
          <td>
            <div class="account-table-identity"><span class="account-avatar" aria-hidden="true">{{
                row.displayName.trim().slice(0, 1).toUpperCase()
              }}</span>
              <div><strong>{{ row.displayName }} <span v-if="row.isRoot"
                                                       class="account-root-label">超级管理员</span><span
                  v-if="row.mustChangePassword"
                  class="account-root-label account-password-pending">待改密</span></strong><span
                  class="account-username">@{{ row.username }}</span></div>
            </div>
          </td>
          <td class="account-role-summary"><span v-if="row.isRoot">系统级权限</span>
            <template v-else-if="row.roles.length"><span v-for="role in row.roles" :key="role.id">{{
                role.name
              }}{{ role.enabled ? '' : '（已禁用）' }}</span></template>
            <span v-else class="account-muted">未分配</span></td>
          <td class="admin-table-status">
            <span class="admin-switch-status">
              <AdminCommonSwitchField :model-value="row.enabled" :label="row.username+'启用状态'"
                :busy="toggling===row.id" :disabled="busy||pending||!canToggle(row)"
                @update:model-value="toggleEnabled(row)"/>
              <span>{{ row.enabled?'启用':'禁用' }}</span>
            </span>
          </td>
          <td class="admin-table-time" :title="formatBeijingTime(row.lastLoginAt)">
            {{ row.lastLoginAt ? formatBeijingTime(row.lastLoginAt, 'minute') : '暂无登录记录' }}
          </td>
          <td class="admin-table-actions">
            <div class="account-row-actions">
              <AdminCommonTooltip :text="row.isRoot ? '超级管理员为受保护账号，仅可查看' : undefined">
                <NuxtLink class="admin-button admin-button-quiet" :class="{ 'account-root-view': row.isRoot }"
                          :to="{ path: `/admin/users/${row.id}`, query: { returnTo: route.fullPath } }">
                  {{ canEditRow(row) ? '编辑' : '查看' }}
                  <Eye v-if="row.isRoot" class="account-action-icon" aria-hidden="true"/>
                  <ArrowUpRight v-else class="account-action-icon" aria-hidden="true"/>
                </NuxtLink>
              </AdminCommonTooltip>
              <AdminCommonTooltip v-if="auth.can('system.users.delete')"
                                  :text="!row.actions.delete ? (row.isRoot ? '超级管理员为受保护账号，不可删除' : row.id === session?.user?.id ? '不能删除当前登录账号' : '该账号不可删除') : undefined"
                                  :disabled-target="!row.actions.delete">
                <UButton class="admin-button admin-button-quiet account-delete-action"
                         :disabled="busy || !row.actions.delete" @click="remove(row)">
                  <Trash2 class="account-action-icon" aria-hidden="true"/>
                  删除
                </UButton>
              </AdminCommonTooltip>
            </div>
          </td>
        </tr>
        </tbody>
      </AdminCommonTable>
      <div v-if="data" class="admin-toolbar admin-pagination"><span>共 {{ data.total }} 条，第 {{ page }} 页</span>
        <SelectField v-model="pageSize" class="account-page-size" label="每页条数"
                     :items="ADMIN_PAGE_SIZES.map(size => ({ label: `${size} 条`, value: String(size) }))"
                     @change="listQuery.applyPageSize"/>
        <UButton class="admin-button" :disabled="pending || page <= 1" @click="listQuery.goToPage(page - 1)">上一页
        </UButton>
        <UButton class="admin-button" :disabled="pending || page * data.pageSize >= data.total"
                 @click="listQuery.goToPage(page + 1)">下一页
        </UButton>
      </div>
    </section>
    <CreateDialog v-model:form="form" v-model:touched="touched" v-model:password="createPassword"
                  v-model:password-touched="passwordTouched" :open="createOpen" :busy="busy" :error="error"
                  :field-errors="fieldErrors" :catalog="profileCatalog"
                  :catalog-pending="profileCatalogPending"
                  :catalog-error="profileCatalogError" @close="closeCreate"
                  @submit="submitCreate"/>
    <AccountToast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.clearFeedback('list')"/>
    <ActionConfirm :confirmation="actionConfirm.state.value" @settle="actionConfirm.settle"/>
  </section>
</template>

<style src="~/assets/admin/css/pages/users.css"></style>

<style scoped>
.admin-module.account-page .admin-table-actions .account-root-view {
  border-color: #c7d3df;
  background: #edf2f6;
  color: #50677d;
}

.admin-module.account-page .admin-table-actions .account-root-view:hover {
  border-color: #9bafc2;
  background: #e1e9f0;
  color: #354f68;
}

.admin-module.account-page .admin-table-actions .account-delete-action:disabled {
  border-color: #e3e7ed;
  background: #f6f7f9;
  color: #9aa5b3;
  opacity: 1;
  cursor: not-allowed;
}
</style>
