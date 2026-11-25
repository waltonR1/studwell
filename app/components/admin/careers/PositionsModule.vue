<!-- 招聘管理界面装配，交互流程由 useCareersManagement 管理。 -->
<script setup lang="ts">
import ModuleNotice from '~/components/admin/business/ModuleNotice.vue'
import {adminContentLocale} from '#shared/config/site-languages'
import {Plus,Search} from 'lucide-vue-next'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import PositionEditorDialog from './PositionEditorDialog.vue'
import {companyBrand} from '~/config/admin/brand'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useCareersManagement} from '~/composables/admin/careers/useCareersManagement'
useHead({title:`岗位管理 | ${companyBrand.name}`})
const preferences=useAdminPreferencesStore(),session=useAdminSessionStore(),route=useRoute()
const actorId=session.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${session.generation}:${actorId}:${route.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {store,toast,confirmation,listQuery,search,statusFilter,pageSize,page,total,draft,busy,saveError,dirty,pending,error,warning,locale,writable,publishable,statusLabel,filtered,sortRows,notify,edit,close,changeState,canMove,movePosition,load,ready}=useCareersManagement()
const statusItems = [
  {value: '', label: '全部状态'},
  {value: 'published', label: '已发布'},
  {value: 'unpublished', label: '未发布'},
]
const flatDepth = () => 0
const noChildren = () => false
const alwaysCollapsed = () => false
const neverHiddenByParent = () => false
const noKind = () => undefined
await ready
</script>

<template>
  <section class="admin-module admin-view-page admin-view-list">
    <AdminCommonPageHeader title="岗位管理" description="维护官网招聘岗位、多语言内容和发布状态。"/>
    <ModuleNotice module="careers"/>
    <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/>
    <AdminCommonConfirmDialog :confirmation="confirmation.state.value" @settle="confirmation.settle"/>

    <section class="admin-view-list-card" aria-label="招聘岗位列表">
      <header class="admin-view-list-heading">
        <h2>岗位列表 <span class="admin-view-result-count">{{ total }} 条</span></h2>
        <p>上移、下移调整官网展示顺序；查询或筛选时暂停排序。</p>
      </header>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="listQuery.submitSearch">
        <div class="admin-view-search">
          <Search class="admin-view-search-icon" aria-hidden="true"/>
          <UInput v-model="search" placeholder="搜索岗位、部门或地点" aria-label="搜索岗位" :maxlength="100" :ui="{base:'admin-input'}"/>
        </div>
        <AdminCommonSelectField
          v-model="statusFilter"
          label="发布状态筛选"
          :items="statusItems"
          :disabled="pending || busy"
          :body-lock="false"
          @change="listQuery.applyFilter"
        />
        <UButton type="submit" class="admin-button" :disabled="pending || busy">查询</UButton>
        <UButton v-if="writable" type="button" class="admin-button admin-button-primary admin-view-create-button" :disabled="pending || busy || !!error" @click="edit()">
          <Plus class="admin-view-action-icon" aria-hidden="true"/>新增岗位
        </UButton>
      </form>

      <AdminCommonFeedback v-if="warning" tone="warning">{{ warning }}</AdminCommonFeedback>
      <AdminCommonDataState v-if="pending" state="loading" title="正在加载岗位…"/>
      <AdminCommonDataState v-else-if="error" state="error" title="加载失败" :description="error">
        <template #action><UButton class="admin-button" @click="load">重试</UButton></template>
      </AdminCommonDataState>
      <AdminCommonDataState
        v-else-if="!sortRows.length"
        state="empty"
        title="暂无岗位"
        description="当前条件下没有岗位，请调整查询或新增岗位。"
      />
      <AdminCommonMenuTreeTable
        v-else
        :rows="sortRows"
        label="招聘岗位"
        name-label="岗位名称"
        :writable="writable"
        :busy="busy || pending"
        :filtered="filtered"
        :show-visibility="false"
        :can-delete="false"
        :min-width="900"
        :depth="flatDepth"
        :has-children="noChildren"
        :expanded="alwaysCollapsed"
        :hidden-by-parent="neverHiddenByParent"
        :kind="noKind"
        :can-move="canMove"
        @move="movePosition"
        @edit="row => edit(row.position)"
      >
        <template #columns>
          <colgroup>
            <col style="width:24%">
            <col style="width:13%">
            <col style="width:16%">
            <col style="width:16%">
            <col style="width:17%">
            <col style="width:14%">
          </colgroup>
        </template>
        <template #head>
          <th>所属部门</th>
          <th>工作地点</th>
          <th class="admin-table-status">发布状态</th>
        </template>
        <template #name="{row}">
          <strong>{{ row.name }}</strong>
        </template>
        <template #cells="{row}">
          <td>{{ row.position.content.localized[adminContentLocale]?.department || '—' }}</td>
          <td>{{ row.position.content.localized[adminContentLocale]?.location || '—' }}</td>
          <td class="admin-table-status">
            <AdminCommonStatusBadge :tone="row.position.publishedReleaseId ? 'success' : 'neutral'">{{ statusLabel(row.position) }}</AdminCommonStatusBadge>
            <AdminCommonDraftBadge v-if="row.position.publishedReleaseId && row.position.changed" :dirty="true">有未发布草稿</AdminCommonDraftBadge>
          </td>
        </template>
        <template #actions="{row}">
          <UButton
            v-if="publishable && row.position.changed"
            class="admin-button"
            :disabled="busy || pending"
            @click="changeState(row.position, 'publish')"
          >发布</UButton>
          <UButton
            v-if="publishable && row.position.publishedReleaseId"
            class="admin-button"
            data-tone="danger"
            :disabled="busy || pending"
            @click="changeState(row.position, 'withdraw')"
          >下线</UButton>
        </template>
      </AdminCommonMenuTreeTable>
      <p v-if="sortRows.length" class="admin-help admin-view-list-note">排序保存后随岗位发布生效；发布状态可在行内直接操作。</p>
      <div v-if="!pending && !error" class="admin-toolbar admin-pagination">
        <span>共 {{ total }} 条，第 {{ page }} 页</span>
        <AdminCommonSelectField
          v-model="pageSize"
          class="admin-view-page-size"
          label="每页条数"
          :items="ADMIN_PAGE_SIZES.map(size => ({label: size + ' 条', value: String(size)}))"
          :disabled="busy || pending"
          :body-lock="false"
          @change="listQuery.applyPageSize"
        />
        <UButton class="admin-button" :disabled="busy || pending || page <= 1" @click="listQuery.goToPage(page - 1)">上一页</UButton>
        <UButton class="admin-button" :disabled="busy || pending || page * (Number(pageSize) || 20) >= total" @click="listQuery.goToPage(page + 1)">下一页</UButton>
      </div>
    </section>

    <PositionEditorDialog v-model:draft="draft" v-model:locale="locale" :busy="busy" :dirty="dirty" :writable="writable" :save-error="saveError" @close="close" @save="notify(store.save())" />
  </section>
</template>
