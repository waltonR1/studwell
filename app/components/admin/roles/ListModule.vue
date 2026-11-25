<!-- 角色列表展示，交互由所属 composable 管理。 -->
<script setup lang="ts">
import {adminEnabledStatusOptions} from '~/config/admin/list'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {Search,Plus,ArrowUpRight,Trash2} from 'lucide-vue-next'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useRolesListManagement} from '~/composables/admin/roles/useRolesListManagement'
const auth=useAdminSessionStore(),preferences=useAdminPreferencesStore(),pageRoute=useRoute()
const actorId=auth.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${auth.generation}:${actorId}:${pageRoute.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {route,store,listQuery,search,status,pageSize,page,form,touched,createdRole,warning,data,pending,loadError,error,busy,toast,fieldErrors,confirmation,open,openCreate,close,create,remove,retryList,ready}=useRolesListManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list">
    <AdminCommonPageHeader title="角色管理" description="本页面管理可分配角色。系统级超级管理员不参与角色授权管理。"/>
    <section class="admin-view-list-card" aria-label="角色查询结果">
      <header class="admin-view-list-heading"><h2>角色列表 <span class="admin-view-result-count">{{ data?.total ?? 0 }} 条</span>
      </h2>
        <p>按职责分配功能与导航入口</p></header>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="listQuery.submitSearch">
        <div class="admin-view-search">
          <Search class="admin-view-search-icon" aria-hidden="true"/>
          <UInput v-model="search" aria-label="角色名称或编码" placeholder="搜索角色名称或编码" :maxlength="100"
                  :ui="{ base: 'admin-input' }"/>
        </div>
        <AdminCommonSelectField v-model="status" label="角色状态筛选"
                                :items="adminEnabledStatusOptions"
                                @change="listQuery.applyFilter"/>
        <UButton type="submit" class="admin-button">查询</UButton>
        <UButton type="button" v-if="auth.can('system.roles.create')"
                 class="admin-button admin-button-primary admin-view-create-button" :disabled="busy"
                 @click="openCreate">
          <Plus class="admin-view-button-icon" aria-hidden="true"/>
          新增角色
        </UButton>
      </form>
      <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}
        <template #action>
          <NuxtLink v-if="createdRole" class="admin-button"
                    :to="{ path: '/admin/roles/' + createdRole.id, query: { returnTo: route.fullPath } }">继续查看角色
          </NuxtLink>
          <UButton v-else class="admin-button" :disabled="busy || pending" @click="retryList">刷新列表</UButton>
        </template>
      </AdminCommonFeedback>
      <AdminCommonToast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.list.feedback = null"/>
      <AdminCommonDataState v-if="pending" state="loading" title="正在加载角色…"/>
      <AdminCommonDataState v-else-if="loadError" state="error" title="角色列表加载失败"
                            :description="loadError">
        <template #action>
          <UButton class="admin-button" @click="retryList">重试</UButton>
        </template>
      </AdminCommonDataState>
      <AdminCommonDataState v-else-if="data && !data.items.length" state="empty" title="暂无角色"
                            description="当前筛选条件下没有角色。"/>
      <AdminCommonTable v-else-if="data" :min-width="760" label="角色列表">
        <colgroup>
          <col style="width: 32%">
          <col style="width: 14%">
          <col style="width: 12%">
          <col style="width: 22%">
          <col style="width: 20%">
        </colgroup>
        <thead>
        <tr>
          <th>角色</th>
          <th class="admin-table-status">状态</th>
          <th class="admin-table-number">
            <AdminCommonTooltip text="包含禁用账号，不含已删除账号" focusable>关联账号</AdminCommonTooltip>
          </th>
          <th>更新时间</th>
          <th class="admin-table-actions">操作</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="row in data.items" :key="row.id">
          <td>
            <div class="admin-view-table-identity"><span class="admin-view-avatar" aria-hidden="true">{{
                row.name.trim().slice(0, 1).toUpperCase()
              }}</span>
              <div><strong>{{ row.name }}</strong><span class="admin-view-username">{{ row.code }}</span></div>
            </div>
          </td>
          <td class="admin-table-status">
            <AdminCommonStatusBadge :tone="row.enabled ? 'success' : 'neutral'">{{
                row.enabled ? '启用' : '禁用'
              }}
            </AdminCommonStatusBadge>
          </td>
          <td class="admin-table-number">
            <AdminCommonTooltip text="包含禁用账号，不含已删除账号" focusable>{{ row.userCount }} 人</AdminCommonTooltip>
          </td>
          <td class="admin-table-time" :title="formatBeijingTime(row.updatedAt)">
            {{ formatBeijingTime(row.updatedAt, 'minute') }}
          </td>
          <td class="admin-table-actions">
            <AdminCommonRowActions>
              <NuxtLink class="admin-button admin-button-quiet"
                        :to="{ path: `/admin/roles/${row.id}`, query: { returnTo: route.fullPath } }">{{
                  auth.can('system.roles.update') || auth.can('system.roles.assign_permissions') || auth.can('system.roles.assign_menus') ? '编辑' : '查看'
                }}
                <ArrowUpRight class="admin-view-action-icon" aria-hidden="true"/>
              </NuxtLink>
              <UButton v-if="auth.can('system.roles.delete')" class="admin-button admin-button-danger" :disabled="busy"
                       @click="remove(row)" data-tone="danger">
                <Trash2 class="admin-view-action-icon" aria-hidden="true"/>
                删除
              </UButton>
            </AdminCommonRowActions>
          </td>
        </tr>
        </tbody>
      </AdminCommonTable>
      <div v-if="data" class="admin-toolbar admin-pagination"><span>共 {{ data.total }} 条，第 {{ page }} 页</span>
        <AdminCommonSelectField v-model="pageSize" class="admin-view-page-size" label="每页条数"
                                :items="ADMIN_PAGE_SIZES.map(size => ({ label: `${size} 条`, value: String(size) }))"
                                @change="listQuery.applyPageSize"/>
        <UButton class="admin-button" :disabled="pending || page <= 1" @click="listQuery.goToPage(page - 1)">上一页
        </UButton>
        <UButton class="admin-button" :disabled="pending || page * data.pageSize >= data.total"
                 @click="listQuery.goToPage(page + 1)">下一页
        </UButton>
      </div>
    </section>
    <AdminCommonDialog :open="open" title="新增角色" description="创建空授权角色后，在编辑页分配权限。" :busy="busy"
                       @close="close">
      <form id="create-role" class="admin-fields admin-view-create-form" @submit.prevent="create">
        <label><span class="admin-view-field-label">角色名称 <span class="admin-view-required"
                                                                   aria-hidden="true">*</span></span>
          <UInput v-model="form.name" :disabled="busy" :aria-invalid="!!fieldErrors.name"
                  aria-describedby="create-name-error" @blur="touched.name = true" required :maxlength="80"
                  :ui="{ base: 'admin-input' }"/>
          <span id="create-name-error" class="admin-field-error" aria-live="polite">{{
              fieldErrors.name || '\u00a0'
            }}</span></label>
        <label><span class="admin-view-field-label">角色编码 <span class="admin-view-required"
                                                                   aria-hidden="true">*</span>（创建后不可修改）</span>
          <UInput v-model="form.code" :disabled="busy" :aria-invalid="!!fieldErrors.code"
                  aria-describedby="create-code-error" @blur="touched.code = true" required :maxlength="64"
                  :ui="{ base: 'admin-input' }"/>
          <span id="create-code-error" class="admin-field-error" aria-live="polite">{{
              fieldErrors.code || '\u00a0'
            }}</span></label>
        <div class="admin-view-status-row admin-view-full-width">
          <div><strong class="admin-view-status-title">启用角色</strong>
            <p class="admin-view-status-description">创建后单独分配操作权限和页面菜单；启用本身不授予任何功能。</p></div>
          <AdminCommonSwitchField v-model="form.enabled" label="启用角色" size="medium" :disabled="busy"/>
        </div>
        <AdminCommonFeedback v-if="error">{{ error }}</AdminCommonFeedback>
      </form>
      <template #actions>
        <UButton class="admin-button" :disabled="busy" @click="close">取消</UButton>
        <UButton form="create-role" type="submit" class="admin-button admin-button-primary" :disabled="busy">
          {{ busy ? '保存中…' : '创建' }}
        </UButton>
      </template>
    </AdminCommonDialog>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </section>
</template>


<style src="~/assets/admin/css/pages/roles.css"></style>
<style scoped>
.admin-module.admin-view-page .admin-table-actions .admin-button[data-tone='danger']:disabled {
  border-color: #e3e7ed;
  background: #f6f7f9;
  color: #9aa5b3;
  opacity: 1;
  cursor: not-allowed;
}
</style>
