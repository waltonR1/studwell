<!-- 字典展示组件，保存与确认交互由所属 composable 接线。 -->
<script setup lang="ts">
import {adminEnabledStatusOptions} from '~/config/admin/list'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {ArrowUpRight, Eye, Plus, Search} from 'lucide-vue-next'
import DictionaryDialog from './DictionaryDialog.vue'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useDictionariesListManagement} from '~/composables/admin/dictionaries/useDictionariesListManagement'
const auth=useAdminSessionStore(),preferences=useAdminPreferencesStore(),pageRoute=useRoute()
const actorId=auth.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${auth.generation}:${actorId}:${pageRoute.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {listQuery,search,status,pageSize,page,data,pending,loadError,busy,canEdit,openDialog,refresh,saved,ready}=useDictionariesListManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list dictionary-page">
    <AdminCommonPageHeader title="数据字典"
                           description="维护有明确消费方的普通业务选项；权限、状态机和系统参数继续由代码定义。"/>
    <section class="admin-view-list-card" aria-label="字典类型查询结果">
      <header class="admin-view-list-heading">
        <h2>字典类型 <span class="admin-view-result-count">{{ data?.total ?? 0 }} 项</span></h2>
        <p>维护部门和岗位选项</p>
      </header>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="listQuery.submitSearch">
        <div class="admin-view-search">
          <Search class="admin-view-search-icon" aria-hidden="true"/>
          <UInput v-model="search" aria-label="字典名称或编码" placeholder="搜索字典名称或编码" :maxlength="100"
                  :ui="{ base: 'admin-input' }"/>
        </div>
        <AdminCommonSelectField v-model="status" label="字典状态筛选"
                                :items="adminEnabledStatusOptions"
                                @change="listQuery.applyFilter"/>
        <UButton type="submit" class="admin-button">查询</UButton>
        <UButton v-if="auth.can('system.dictionaries.create')" type="button"
                 class="admin-button admin-button-primary admin-view-create-button" :disabled="busy"
                 @click="openDialog(null)">
          <Plus class="admin-view-button-icon" aria-hidden="true"/>
          新增字典
        </UButton>
      </form>
      <AdminCommonDataState v-if="pending" state="loading" title="正在加载字典…"/>
      <AdminCommonDataState v-else-if="loadError" state="error" title="字典列表加载失败"
                            :description="loadError">
        <template #action>
          <UButton class="admin-button" @click="refresh()">重试</UButton>
        </template>
      </AdminCommonDataState>
      <AdminCommonDataState v-else-if="data && !data.items.length" state="empty" title="暂无字典"
                            description="没有业务需求时保持空目录即可。"/>
      <AdminCommonTable v-else-if="data" :min-width="820" label="字典类型列表">
        <colgroup>
          <col style="width: 28%">
          <col style="width: 18%">
          <col style="width: 13%">
          <col style="width: 10%">
          <col style="width: 19%">
          <col style="width: 12%">
        </colgroup>
        <thead>
        <tr>
          <th>字典名称</th>
          <th>编码</th>
          <th class="admin-table-number">选项数</th>
          <th class="admin-table-status">状态</th>
          <th>更新时间</th>
          <th class="admin-table-actions">操作</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="row in data.items" :key="row.id">
          <td><strong class="dictionary-name">{{ row.name }}</strong><span v-if="row.description"
                                                                           class="dictionary-list-help">{{
              row.description
            }}</span></td>
          <td><span class="dictionary-code">{{ row.code }}</span></td>
          <td class="admin-table-number">{{ row.optionCount }}<span
              class="dictionary-list-help">{{ row.enabledOptionCount }} 项启用</span></td>
          <td class="admin-table-status">
            <AdminCommonStatusBadge :tone="row.enabled ? 'success' : 'neutral'">{{
                row.enabled ? '启用' : '禁用'
              }}
            </AdminCommonStatusBadge>
          </td>
          <td class="admin-table-time" :title="formatBeijingTime(row.updatedAt)">
            {{ formatBeijingTime(row.updatedAt, 'minute') }}
          </td>
          <td class="admin-table-actions">
            <AdminCommonRowActions>
              <UButton class="admin-button admin-button-quiet" :disabled="busy" @click="openDialog(row.id)">
                {{ canEdit() ? '编辑' : '查看' }}
                <ArrowUpRight v-if="canEdit()" class="admin-view-action-icon" aria-hidden="true"/>
                <Eye v-else class="admin-view-action-icon" aria-hidden="true"/>
              </UButton>
            </AdminCommonRowActions>
          </td>
        </tr>
        </tbody>
      </AdminCommonTable>
      <div v-if="data" class="admin-toolbar admin-pagination">
        <span>共 {{ data.total }} 条，第 {{ page }} 页</span>
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
    <DictionaryDialog @saved="saved"/>
  </section>
</template>

<style src="~/assets/admin/css/pages/dictionaries.css"></style>
