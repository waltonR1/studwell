<!-- 定时任务TaskRunHistory：展示所属区块，通过事件交由页面协调操作。 -->
<script setup lang="ts">
import {taskRunTones} from '~/config/admin/tasks'
import {Search} from 'lucide-vue-next'
import RowActions from '~/components/admin/common/RowActions.vue'
import SelectField from '~/components/admin/common/SelectField.vue'
import type {PageData} from '#shared/types/api'
import type {TaskRecord, TaskRunRecord} from '#shared/types/admin/tasks'
import {runStatusNames, runTriggerNames} from '#shared/config/admin/tasks'
import {formatBeijingTime} from '#shared/utils/beijing-time'

defineProps<{ historyTask: TaskRecord; history: PageData<TaskRunRecord> | null; historyBusy: boolean }>()
const page = defineModel<number>('page', {required: true})
const filters = defineModel<{
  status: string;
  trigger: string;
  startDate: string;
  endDate: string
}>('filters', {required: true})
const emit = defineEmits<{ close: []; filter: [reset: boolean]; detail: [row: TaskRunRecord] }>()
</script>
<template>
  <section class="admin-view-list-card task-history" aria-label="任务执行记录">
    <header class="admin-view-list-heading"><h2>{{ historyTask.name }}<span class="task-heading-divider">/</span>执行记录
    </h2>
      <UButton class="admin-button task-collapse" @click="emit('close')">收起记录</UButton>
    </header>
    <div class="admin-toolbar admin-filter-bar admin-view-filters task-history-filters">
      <SelectField v-model="filters.status" label="执行状态" :body-lock="false"
                   :items="[{ label: '全部执行状态', value: '' }, ...Object.entries(runStatusNames).map(([value, label]) => ({ value, label }))]"/>
      <SelectField v-model="filters.trigger" label="触发方式" :body-lock="false"
                   :items="[{ label: '全部触发方式', value: '' }, ...Object.entries(runTriggerNames).map(([value, label]) => ({ value, label }))]"/>
      <div class="task-date-range"><input v-model="filters.startDate" class="admin-input" type="date"
                                          aria-label="开始日期"><span>至</span><input v-model="filters.endDate"
                                                                                      class="admin-input" type="date"
                                                                                      aria-label="结束日期"></div>
      <UButton class="admin-button" :disabled="historyBusy" @click="emit('filter', true)">
        <Search class="admin-view-action-icon" aria-hidden="true"/>
        查询
      </UButton>
    </div>
    <AdminCommonDataState v-if="historyBusy" state="loading" title="正在加载执行记录…"/>
    <AdminCommonTable v-else-if="history?.items.length" label="执行记录" :min-width="800">
      <thead>
      <tr>
        <th>执行编号</th>
        <th>触发方式</th>
        <th>执行状态</th>
        <th>开始 / 结束时间</th>
        <th class="admin-table-number">已提交删除</th>
        <th class="admin-table-actions">操作</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="item in history.items" :key="item.id">
        <td class="task-run-id">#{{ item.id }}</td>
        <td><span class="task-trigger">{{ runTriggerNames[item.trigger] }}</span></td>
        <td>
          <AdminCommonStatusBadge :tone="taskRunTones[item.status]">{{
              runStatusNames[item.status]
            }}
          </AdminCommonStatusBadge>
          <span v-if="item.pendingControl" class="task-help task-warning">控制请求处理中</span></td>
        <td><span class="task-time">{{ formatBeijingTime(item.startedAt) }}</span><span
            class="task-help task-time">{{ formatBeijingTime(item.finishedAt) }}</span></td>
        <td class="admin-table-number task-count">{{ item.counts.reduce((n, c) => n + c.deletedCount, 0) }}<span
            class="task-count-unit">条</span></td>
        <td class="admin-table-actions">
          <RowActions>
            <UButton class="admin-button" @click="emit('detail', item)">查看详情</UButton>
          </RowActions>
        </td>
      </tr>
      </tbody>
    </AdminCommonTable>
    <AdminCommonDataState v-else state="empty" title="暂无执行记录"
                          description="任务执行后将在这里显示运行结果与处理数量。"/>
    <div v-if="history" class="admin-toolbar admin-pagination"><span>共 {{ history.total }} 条，第 {{ page }} 页</span>
      <UButton class="admin-button" :disabled="historyBusy || page <= 1" @click="page--; emit('filter', false)">上一页
      </UButton>
      <UButton class="admin-button" :disabled="historyBusy || page * 20 >= history.total"
               @click="page++; emit('filter', false)">下一页
      </UButton>
    </div>
  </section>
</template>
<style scoped src="~/assets/admin/css/pages/task-common.css"></style>
<style scoped src="~/assets/admin/css/pages/task-history.css"></style>
