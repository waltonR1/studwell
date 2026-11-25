<!-- 咨询列表和详情界面装配；查询与生命周期由 useInquiryManagement 接线。 -->
<script setup lang="ts">
import ModuleNotice from '~/components/admin/business/ModuleNotice.vue'
import {ArrowUpRight,Search} from 'lucide-vue-next'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {statuses,statusTones,queues,statusOptions} from '~/config/admin/inquiry-list'
import CustomerSummary from './CustomerSummary.vue'
import HandlingForms from './HandlingForms.vue'
import DeliveryTimeline from './DeliveryTimeline.vue'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useInquiryManagement} from '~/composables/admin/inquiries/useInquiryManagement'
const session=useAdminSessionStore(),preferences=useAdminPreferencesStore(),route=useRoute()
const actorId=session.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${session.generation}:${actorId}:${route.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {listQuery,search,queue,status,category,assigneeFilter,from,to,pageSize,filterError,page,listError,warning,list,loading,selected,detail,detailPending,detailError,detailVisible,detailStale,submitErrors,nextStatus,assignee,note,repliedExternally,reply,closingDelivery,closeReason,writable,canAssign,canSend,canReply,awaitingDelivery,canClaim,changed,refreshList,open,beginMailClose,cancelMailClose,busy,toast,detailStatusOptions,assigneeOptions,saveAssignment,saveNote,sendReply,retryMail,closeMailIssue,closeDetail,ready}=useInquiryManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list">
    <AdminCommonPageHeader title="咨询列表" description="查看官网咨询、分派负责人并记录跟进。"/>
    <ModuleNotice module="inquiries"/>
    <AdminCommonFeedback v-if="warning && !detailVisible" tone="warning">
      {{ warning }}
      <template #action><UButton class="admin-button" :disabled="loading" @click="refreshList()">刷新列表</UButton></template>
    </AdminCommonFeedback>
    <section class="admin-view-list-card" aria-label="咨询列表">
      <header class="admin-view-list-heading">
        <h2>咨询列表 <span v-if="list" class="admin-view-result-count">{{ list.total }} 条</span></h2>
      </header>
      <form class="admin-toolbar admin-filter-bar admin-view-filters" @submit.prevent="listQuery.submitSearch">
        <div class="admin-view-search">
          <Search class="admin-view-search-icon" aria-hidden="true"/>
          <UInput v-model="search" aria-label="搜索咨询编号或客户邮箱" placeholder="搜索咨询编号或客户邮箱" :maxlength="254" :ui="{base:'admin-input'}"/>
        </div>
        <AdminCommonSelectField v-model="queue" label="咨询工作队列" :items="queues" :disabled="loading" @change="listQuery.selectQueue"/>
        <AdminCommonSelectField v-model="status" label="处理状态" :items="[{value:'',label:'全部状态'}, ...statusOptions]" :disabled="loading" @change="listQuery.applyFilter('status')"/>
        <AdminCommonSelectField v-model="category" label="咨询类型" :items="[{value:'',label:'全部类型'}, ...(list?.categories ?? []).map(item => ({value:item.code,label:item.label + (item.enabled ? '' : '（已停用）')}))]" :disabled="loading" @change="listQuery.applyFilter('category')"/>
        <AdminCommonSelectField v-model="assigneeFilter" label="负责人" :items="[{value:'',label:'全部负责人'}, ...(list?.assignees ?? []).map(item => ({value:item.id,label:item.name}))]" :disabled="loading || queue === 'mine' || queue === 'mine_reply' || queue === 'unassigned'" @change="listQuery.applyFilter('assigneeId')"/>
        <div class="inquiry-date-range" role="group" aria-label="提交日期">
          <input v-model="from" class="admin-input inquiry-date-input" type="date" aria-label="提交起日" :max="to || undefined"/>
          <span class="inquiry-date-separator" aria-hidden="true">至</span>
          <input v-model="to" class="admin-input inquiry-date-input" type="date" aria-label="提交止日" :min="from || undefined"/>
        </div>
        <UButton type="submit" class="admin-button" :disabled="loading">查询</UButton>
      </form>
      <AdminCommonFeedback v-if="filterError" tone="error">{{ filterError }}</AdminCommonFeedback>
      <AdminCommonDataState v-if="loading" state="loading" title="正在加载咨询…"/>
      <AdminCommonDataState v-else-if="listError" state="error" title="加载失败" :description="listError">
        <template #action><UButton class="admin-button" @click="refreshList()">重试</UButton></template>
      </AdminCommonDataState>
      <AdminCommonDataState v-else-if="!list?.items.length" state="empty" title="暂无符合条件的咨询"/>
      <AdminCommonTable v-else label="客户咨询" :min-width="850">
        <thead><tr><th>咨询编号 / 客户</th><th>类型</th><th>负责人</th><th>提交时间</th><th>最近跟进</th><th>状态</th><th class="admin-table-actions">操作</th></tr></thead>
        <tbody>
          <tr v-for="row in list.items" :key="row.id">
            <td><div class="admin-view-table-identity"><div><strong>{{ row.name }}</strong><span class="admin-view-username">{{ row.id }}</span></div></div></td>
            <td>{{ row.categoryLabel }}</td>
            <td>{{ row.assigneeName || '未分派' }}</td>
            <td>{{ formatBeijingTime(row.createdAt, 'minute') }}</td>
            <td>{{ formatBeijingTime(row.lastFollowUpAt, 'minute') }}</td>
            <td><div class="inquiry-row-status">
              <AdminCommonStatusBadge :tone="statusTones[row.status]">{{ statuses[row.status] }}</AdminCommonStatusBadge>
              <AdminCommonStatusBadge v-if="row.deliveryIssue" tone="danger">投递异常</AdminCommonStatusBadge>
            </div></td>
            <td class="admin-table-actions">
              <AdminCommonRowActions>
                <UButton class="admin-button admin-button-quiet" :disabled="detailPending"
                  :aria-busy="detailPending && selected === row.id" @click="open(row.id)">
                  {{ detailPending && selected === row.id ? '加载中…' : '查看' }}<ArrowUpRight class="admin-view-action-icon" aria-hidden="true"/>
                </UButton>
              </AdminCommonRowActions>
            </td>
          </tr>
        </tbody>
      </AdminCommonTable>
      <div v-if="list && !listError" class="admin-toolbar admin-pagination">
        <span>共 {{ list.total }} 条，第 {{ page }} 页</span>
        <AdminCommonSelectField v-model="pageSize" class="admin-view-page-size" label="每页条数"
          :items="ADMIN_PAGE_SIZES.map(size => ({label:size + ' 条', value:String(size)}))"
          :disabled="loading" @change="listQuery.applyPageSize"/>
        <UButton class="admin-button" :disabled="loading || page <= 1" @click="listQuery.goToPage(page - 1)">上一页</UButton>
        <UButton class="admin-button" :disabled="loading || page * list.pageSize >= list.total" @click="listQuery.goToPage(page + 1)">下一页</UButton>
      </div>
    </section>
    <AdminCommonDialog :open="detailVisible" title="咨询详情" size="large" :busy="busy" @close="closeDetail">
      <AdminCommonDataState v-if="detailPending" state="loading" title="正在加载详情…"/>
      <div v-else-if="detail" class="inquiry-detail">
        <CustomerSummary :inquiry="detail.inquiry" />
        <HandlingForms v-model:next-status="nextStatus" v-model:assignee="assignee" v-model:note="note" v-model:replied-externally="repliedExternally" v-model:reply="reply" :detail="detail" :writable="writable" :can-assign="canAssign" :can-claim="canClaim" :can-reply="canReply" :busy="busy" :detail-stale="detailStale" :changed="changed" :detail-status-options="detailStatusOptions" :assignee-options="assigneeOptions" :submit-errors="submitErrors" @assignment="saveAssignment" @save-note="saveNote" @send-reply="sendReply" />
        <DeliveryTimeline v-model:close-reason="closeReason" :detail="detail" :awaiting-delivery="awaitingDelivery" :can-send="canSend" :busy="busy" :detail-stale="detailStale" :closing-delivery="closingDelivery" :close-error="submitErrors.close" @close-issue="closeMailIssue" @cancel-close="cancelMailClose" @retry="retryMail" @begin-close="beginMailClose" />
      </div>
      <AdminCommonFeedback v-if="warning" tone="warning">
        {{ warning }}
        <template #action><UButton class="admin-button" :disabled="loading" @click="refreshList()">刷新列表</UButton></template>
      </AdminCommonFeedback>
      <AdminCommonFeedback v-if="detailError" tone="error">{{ detailError }}</AdminCommonFeedback>
      <template #actions>
        <UButton v-if="detailError || detailStale" class="admin-button" :disabled="busy" @click="open(selected, true)">重新加载详情</UButton>
        <UButton class="admin-button" :disabled="busy" @click="closeDetail">关闭</UButton>
      </template>
    </AdminCommonDialog>
    <AdminCommonToast :notification="toast.notification.value" @dismiss="toast.dismiss"/>
  </section>
</template>

<style scoped>
.inquiry-row-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.inquiry-date-range {
  display: flex;
  flex: 0 1 330px;
  align-items: center;
  gap: 8px;
  min-width: 300px;
}
.inquiry-date-input { width: 142px; min-width: 0; }
.inquiry-date-separator { flex: none; color: var(--admin-view-muted, #778497); font-size: 12px; }
@media (max-width: 520px) {
  .inquiry-date-range { flex-basis: 100%; width: 100%; }
  .inquiry-date-input { flex: 1; width: 0; }
}
</style>

<style scoped src="~/assets/admin/css/components/inquiry-detail.css"></style>
