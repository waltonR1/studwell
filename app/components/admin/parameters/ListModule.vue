<!-- 参数列表和编辑器展示，操作编排由 useParameterManagement 提供。 -->
<script setup lang="ts">
import ParameterEditorDialog from './ParameterEditorDialog.vue'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {Search, Eye, ArrowUpRight} from 'lucide-vue-next'
import RowActions from '~/components/admin/common/RowActions.vue'
import Toast from '~/components/admin/common/Toast.vue'
import SelectField from '~/components/admin/common/SelectField.vue'
import ConfirmDialog from '~/components/admin/common/ConfirmDialog.vue'
import {parameterGroups} from '~/config/admin/parameters'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useParameterManagement} from '~/composables/admin/parameters/useParameterManagement'
const auth=useAdminSessionStore(),preferences=useAdminPreferencesStore(),pageRoute=useRoute()
const actorId=auth.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${auth.generation}:${actorId}:${pageRoute.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {store,pending,loadError,warning,search,category,page,pageSize,rows,filteredRows,pageRows,toast,busy,confirmation,closeEditor,save,reload,resetPage,applySearch,groupName,displayValue,edit,canEdit,ready}=useParameterManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list parameter-page">
    <AdminCommonPageHeader title="系统参数" description="维护后台运行参数与安全策略，修改保存后按各项说明生效。"/>
    <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
    <section class="admin-view-list-card" aria-label="参数列表">
      <header class="admin-view-list-heading"><h2>参数列表 <span class="admin-view-result-count">{{
          filteredRows.length
        }} 项</span></h2>
        <p>按用途分类维护后台参数</p></header>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="applySearch">
        <div class="admin-view-search">
          <Search class="admin-view-search-icon" aria-hidden="true"/>
          <UInput v-model="search" aria-label="参数名称或编码" placeholder="搜索参数名称或编码" :maxlength="100"
                  :ui="{ base: 'admin-input' }"/>
        </div>
        <SelectField v-model="category" label="参数分类"
                     :items="[{ label: '全部分类', value: '' }, ...parameterGroups.map(group => ({ label: group.name, value: group.key }))]"
                     :body-lock="false" @change="page = 1"/>
        <UButton type="submit" class="admin-button">查询</UButton>
      </form>
      <AdminCommonDataState v-if="pending && !rows.length" state="loading" title="正在加载参数…"/>
      <AdminCommonDataState v-else-if="loadError && !rows.length" state="error" title="参数加载失败"
                            :description="loadError">
        <template #action>
          <UButton class="admin-button" @click="reload">重新加载</UButton>
        </template>
      </AdminCommonDataState>
      <AdminCommonDataState v-else-if="!filteredRows.length" state="empty" title="没有符合条件的参数"
                            description="请调整名称或分类后重新查询。"/>
      <AdminCommonTable v-else :min-width="940" label="系统参数列表">
        <colgroup>
          <col style="width: 28%">
          <col style="width: 12%">
          <col style="width: 18%">
          <col style="width: 28%">
          <col style="width: 14%">
        </colgroup>
        <thead>
        <tr>
          <th>参数名称</th>
          <th>分类</th>
          <th>当前值</th>
          <th>生效说明</th>
          <th class="admin-table-actions">操作</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="row in pageRows" :key="row.id">
          <td><strong class="parameter-name">{{ row.name }}</strong><span v-if="row.description"
                                                                          class="parameter-list-help">{{
              row.description
            }}</span></td>
          <td>{{ groupName(row.group) }}</td>
          <td>
            <AdminCommonStatusBadge v-if="row.type === 'boolean'" :tone="row.value ? 'success' : 'neutral'">
              {{ displayValue(row.value, row) }}
            </AdminCommonStatusBadge>
            <span v-else>{{ displayValue(row.value, row) }}</span><span class="parameter-list-help"
                                                                        :class="{ 'parameter-invalid': row.invalidOverride }">{{
              row.invalidOverride ? '无效配置，已回退默认值' : row.override === null ? '默认值' : '自定义值'
            }}</span></td>
          <td>{{ row.effect }}<span class="parameter-list-help">{{ row.consumers }}</span></td>
          <td class="admin-table-actions">
            <RowActions>
              <UButton class="admin-button admin-button-quiet" :disabled="busy" @click="edit(row)">
                {{ canEdit(row) ? '编辑' : '查看' }}
                <ArrowUpRight v-if="canEdit(row)" class="admin-view-action-icon" aria-hidden="true"/>
                <Eye v-else class="admin-view-action-icon" aria-hidden="true"/>
              </UButton>
            </RowActions>
          </td>
        </tr>
        </tbody>
      </AdminCommonTable>
      <div v-if="filteredRows.length" class="admin-toolbar admin-pagination parameter-pagination">
        <span>共 {{ filteredRows.length }} 项，第 {{ page }} 页</span>
        <SelectField v-model="pageSize" class="admin-view-page-size" label="每页条数"
                     :items="ADMIN_PAGE_SIZES.map(size => ({ label: `${size} 条`, value: String(size) }))"
                     :body-lock="false" @change="resetPage"/>
        <UButton class="admin-button" :disabled="page <= 1" @click="page--">上一页</UButton>
        <UButton class="admin-button" :disabled="page * Number(pageSize) >= filteredRows.length" @click="page++">
          下一页
        </UButton>
      </div>
    </section>
    <ParameterEditorDialog @close="closeEditor" @save="save"/>
    <Toast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="store.feedback = null"/>
    <ConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>
  </section>
</template>
<style scoped>
.parameter-name {
  color: #344960;
  font-weight: 550;
}

.parameter-list-help {
  display: block;
  margin-top: 5px;
  color: #8b98a9;
  font-size: 11px;
  line-height: 1.6;
}

.parameter-invalid {
  color: #a66f22;
}

.parameter-page :deep(.parameter-grid) {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}

.parameter-page :deep(.parameter-field) {
  min-width: 0;
}

.parameter-page :deep(.parameter-field > label) {
  display: block;
  margin-bottom: 8px;
  color: #526278;
  font-size: 13px;
  font-weight: 500;
}

.parameter-page :deep(.parameter-control) {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  margin-bottom: 8px;
  color: #778497;
  font-size: 13px;
}

.parameter-page :deep(.parameter-control input) {
  flex: 1;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.parameter-page :deep(.parameter-control > .admin-select) {
  flex: 1;
  min-width: 0;
}

.parameter-page :deep(.parameter-help) {
  margin: 0 0 6px;
  color: #8491a2;
  font-size: 12px;
  line-height: 1.7;
}

.parameter-page :deep(.parameter-meta), .parameter-page :deep(.parameter-definition) {
  margin: 5px 0;
  color: #8b98a9;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.parameter-page :deep(.parameter-definition p) {
  margin: 5px 0;
}

@media (max-width: 760px) {
  .parameter-page :deep(.parameter-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
