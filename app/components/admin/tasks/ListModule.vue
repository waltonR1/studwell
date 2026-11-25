<!-- 任务界面装配，页面交互由专属 composable 接线。 -->
<script setup lang="ts">
import TaskTable from './TaskTable.vue'
import TaskConfigDialog from './TaskConfigDialog.vue'
import TaskRunHistory from './TaskRunHistory.vue'
import TaskRunDetailDialog from './TaskRunDetailDialog.vue'
import ConfirmDialog from '~/components/admin/common/ConfirmDialog.vue'
import {useTaskManagement} from '~/composables/admin/tasks/useTaskManagement'
const {store,data,pending,error,rows,search,enabled,latestStatus,stale,notification,validationError,loadFailure,canConfigure,canChangeStatus,canRun,canStop,canForceStop,canReadAudit,editing,currentTask,configurationStale,runDisabledReason,draft,previewTimes,dirty,historyTask,history,filters,page,historyBusy,detail,edit,preview,save,showHistory,filterHistory,showDetail,closeHistory,closeDetail,busy,confirm,changingStatusId,close,toggle,run,control,ready}=useTaskManagement()
await ready
</script>
<template>
  <section class="admin-module admin-view-page admin-view-list task-page">
    <AdminCommonPageHeader title="定时任务" description="统一管理内置维护任务，查看执行计划、运行状态与处理记录。"/>
    <AdminCommonToast :notification="notification?{message:notification.message,tone:notification.status}:null" @dismiss="store.notification = null"/>
    <AdminCommonFeedback v-if="loadFailure" tone="error">{{ loadFailure }}</AdminCommonFeedback>
    <AdminCommonFeedback v-if="error&&!stale" tone="error">{{ error }}</AdminCommonFeedback>
    <div v-if="stale" class="task-list-freshness"><AdminCommonStatusBadge tone="warning">数据待刷新</AdminCommonStatusBadge><span>当前展示上次快照，请使用右上角刷新获取最新状态。</span></div>
    <TaskTable v-model:search="search" v-model:enabled="enabled" v-model:latest-status="latestStatus" :rows="rows"
               :pending="pending" :loaded="!!data" :busy="busy" :changing-status-id="changingStatusId"
               :can-configure="canConfigure" :can-change-status="canChangeStatus" :can-stop="canStop" @edit="edit"
               @toggle="toggle" @history="showHistory" @stop="control($event, 'stop')"/>
    <TaskRunHistory v-if="historyTask" v-model:page="page" v-model:filters="filters" :history-task="historyTask"
                    :history="history" :history-busy="historyBusy" @close="closeHistory" @filter="filterHistory"
                    @detail="showDetail"/>
    <TaskConfigDialog v-model:draft="draft" :editing="editing" :current-task="currentTask" :busy="busy"
                      :can-configure="canConfigure" :can-run="canRun" :can-stop="canStop" :can-force-stop="canForceStop"
                      :validation-error="validationError" :configuration-stale="configurationStale"
                      :run-disabled-reason="runDisabledReason" :preview-times="previewTimes" :dirty="dirty"
                      @close="close" @preview="preview" @save="save" @run="run" @control="control"/>
    <TaskRunDetailDialog :detail="detail" :can-read-audit="canReadAudit" @close="closeDetail"/>
    <ConfirmDialog :confirmation="confirm.state.value" @settle="confirm.settle"/>
  </section>
</template>
<style scoped>
.task-page {
  color: #455a72;
}
.task-list-freshness { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-block: 12px; color: var(--admin-view-muted); font-size: 12px; }
</style>
