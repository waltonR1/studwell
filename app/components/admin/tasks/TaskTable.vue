<!-- 定时任务TaskTable：展示所属区块，通过事件交由页面协调操作。 -->
<script setup lang="ts">
import {taskRunTones} from '~/config/admin/tasks'
import {Search, Clock3} from 'lucide-vue-next'
import RowActions from '~/components/admin/common/RowActions.vue'
import SelectField from '~/components/admin/common/SelectField.vue'
import SwitchField from '~/components/admin/common/SwitchField.vue'
import type {TaskRecord, TaskRunRecord} from '#shared/types/admin/tasks'
import {runStatusNames} from '#shared/config/admin/tasks'
import {taskScheduleText} from '#shared/utils/admin/task-schedule'
import {formatBeijingTime} from '#shared/utils/beijing-time'

defineProps<{
  rows: TaskRecord[];
  pending: boolean;
  loaded: boolean;
  busy: boolean;
  changingStatusId: string | null;
  canConfigure: boolean;
  canChangeStatus: boolean;
  canStop: boolean
}>()
const search = defineModel<string>('search', {required: true})
const enabled = defineModel<string>('enabled', {required: true})
const latestStatus = defineModel<string>('latestStatus', {required: true})
const emit = defineEmits<{
  toggle: [row: TaskRecord];
  edit: [row: TaskRecord];
  history: [row: TaskRecord];
  stop: [row: TaskRunRecord]
}>()
</script>
<template>
  <section class="admin-view-list-card" aria-label="定时任务">
    <header class="admin-view-list-heading">
      <h2>内置任务 <span class="admin-view-result-count">{{ rows.length }} 项</span></h2>
      <p class="task-timezone">
        <Clock3 aria-hidden="true"/>
        北京时间 UTC+8 · 每10秒更新状态
      </p>
    </header>
    <div class="admin-toolbar admin-filter-bar admin-view-filters task-filters">
      <div class="admin-view-search">
        <Search class="admin-view-search-icon" aria-hidden="true"/>
        <UInput v-model="search" aria-label="任务名称或编码" placeholder="搜索任务名称或编码"
                :ui="{ base: 'admin-input' }"/>
      </div>
      <SelectField v-model="enabled" label="任务状态" :body-lock="false"
                   :items="[{ label: '全部状态', value: '' }, { label: '启用', value: 'true' }, { label: '暂停', value: 'false' }]"/>
      <SelectField v-model="latestStatus" label="最近执行结果" :body-lock="false"
                   :items="[{ label: '全部执行结果', value: '' }, ...Object.entries(runStatusNames).map(([value, label]) => ({ value, label }))]"/>
    </div>
    <AdminCommonDataState v-if="pending && !loaded" state="loading" title="正在加载任务…"/>
    <AdminCommonDataState v-else-if="!rows.length" state="empty" title="没有符合条件的任务"
                          description="请调整任务名称、状态或执行结果筛选。"/>
    <AdminCommonTable v-else label="定时任务列表" :min-width="840">
      <colgroup>
        <col style="width:22%">
        <col style="width:12%">
        <col style="width:24%">
        <col style="width:23%">
        <col style="width:19%">
      </colgroup>
      <thead>
      <tr>
        <th>任务名称</th>
        <th>任务状态</th>
        <th>执行计划</th>
        <th>最近执行</th>
        <th class="admin-table-actions">操作</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="row in rows" :key="row.id">
        <td><strong class="task-name">{{ row.name }}</strong></td>
        <td>
          <div class="task-status-control">
            <SwitchField :model-value="row.enabled" :label="`启用${row.name}`"
                         :disabled="busy || !!changingStatusId || !canChangeStatus" :busy="changingStatusId === row.id"
                         @update:model-value="emit('toggle', row)"/>
            <span>{{ row.enabled ? '启用' : '暂停' }}</span></div>
          <span v-if="!row.online" class="task-help task-warning">{{
              row.executionAllowed ? '调度器离线' : '当前环境禁止执行'
            }}</span><span v-else-if="row.version !== row.appliedVersion"
                           class="task-help task-warning">配置待应用</span></td>
        <td><span class="task-schedule">{{ taskScheduleText(row.schedule) }}</span></td>
        <td>
          <template v-if="row.lastRun">
            <AdminCommonStatusBadge :tone="taskRunTones[row.lastRun.status]">{{
                runStatusNames[row.lastRun.status]
              }}
            </AdminCommonStatusBadge>
            <span class="task-time task-last-time">{{ formatBeijingTime(row.lastRun.startedAt) }}</span></template>
          <span v-else class="task-empty">尚未执行</span><span v-if="row.activeRun?.pendingControl"
                                                               class="task-help task-warning">{{
            row.activeRun.pendingControl === 'force' ? '终止中，等待事务确认' : '停止中，等待批次完成'
          }}</span></td>
        <td class="admin-table-actions">
          <RowActions class="task-actions">
            <UButton class="admin-button" :disabled="busy" @click="emit('edit', row)">{{
                canConfigure ? '配置' : '查看'
              }}
            </UButton>
            <UButton class="admin-button" data-tone="neutral" @click="emit('history', row)">执行记录</UButton>
            <UButton v-if="row.activeRun && canStop" class="admin-button"
                     :disabled="busy || !row.executionAllowed || !!row.activeRun.pendingControl"
                     @click="emit('stop', row.activeRun)">停止
            </UButton>
          </RowActions>
        </td>
      </tr>
      </tbody>
    </AdminCommonTable>
  </section>
</template>
<style scoped src="~/assets/admin/css/pages/task-common.css"></style>
<style scoped src="~/assets/admin/css/pages/task-table.css"></style>
