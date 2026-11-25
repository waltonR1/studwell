<!-- 定时任务TaskRunDetailDialog：展示所属区块，通过事件交由页面协调操作。 -->
<script setup lang="ts">
import {taskRunTones, taskCountNames} from '~/config/admin/tasks'
import {Clock3} from 'lucide-vue-next'
import type {TaskRunRecord} from '#shared/types/admin/tasks'
import {runStatusNames, runTriggerNames} from '#shared/config/admin/tasks'
import {taskScheduleText} from '#shared/utils/admin/task-schedule'
import {formatBeijingTime} from '#shared/utils/beijing-time'

defineProps<{ detail: TaskRunRecord | null; canReadAudit: boolean }>()
const emit = defineEmits<{ close: [] }>()

</script>
<template>
  <AdminCommonDialog :open="!!detail" title="执行详情" description="本次执行的实际配置、时间与已提交处理结果。"
                     size="large" @close="emit('close')">
    <div v-if="detail" class="task-detail">
      <div class="task-detail-heading">
        <div><span class="task-eyebrow">执行编号</span><strong>#{{ detail.id }}</strong></div>
        <div class="task-detail-badges"><span class="task-trigger">{{ runTriggerNames[detail.trigger] }}</span>
          <AdminCommonStatusBadge :tone="taskRunTones[detail.status]">{{
              runStatusNames[detail.status]
            }}
          </AdminCommonStatusBadge>
        </div>
      </div>
      <AdminCommonFeedback v-if="detail.reason" :tone="taskRunTones[detail.status] === 'danger' ? 'error' : 'info'">
        {{ detail.reason }}
      </AdminCommonFeedback>
      <dl class="task-facts">
        <div>
          <dt>创建时间</dt>
          <dd>{{ formatBeijingTime(detail.createdAt) }}</dd>
        </div>
        <div>
          <dt>开始时间</dt>
          <dd>{{ formatBeijingTime(detail.startedAt) }}</dd>
        </div>
        <div>
          <dt>结束时间</dt>
          <dd>{{ formatBeijingTime(detail.finishedAt) }}</dd>
        </div>
        <div>
          <dt>执行耗时</dt>
          <dd>{{ detail.durationMs === null ? '—' : `${detail.durationMs} ms` }}</dd>
        </div>
        <div>
          <dt>重试 / 续跑</dt>
          <dd>{{ detail.attempt }} 次 / {{ detail.continuation }} 次</dd>
        </div>
        <div>
          <dt>下次重试</dt>
          <dd>{{ formatBeijingTime(detail.retryAt) }}</dd>
        </div>
      </dl>
      <section class="task-detail-section"><h3>本次配置快照</h3>
        <p class="task-snapshot-plan">
          <Clock3 aria-hidden="true"/>
          {{ taskScheduleText(detail.snapshot.schedule) }}
        </p>
        <dl v-if="detail.snapshot.retention" class="task-retention-summary">
          <div>
            <dt>登录日志</dt>
            <dd>{{ detail.snapshot.retention.login }}<span>天</span></dd>
          </div>
          <div>
            <dt>操作审计</dt>
            <dd>{{ detail.snapshot.retention.audit }}<span>天</span></dd>
          </div>
          <div>
            <dt>安全日志</dt>
            <dd>{{ detail.snapshot.retention.security }}<span>天</span></dd>
          </div>
        </dl>
      </section>
      <section class="task-detail-section"><h3>已提交批次<span>仅统计已成功提交的数据</span></h3>
        <p v-if="!detail.counts.length" class="task-help">尚无已提交批次。</p>
        <div v-else class="task-batch-list">
          <div v-for="count in detail.counts" :key="count.kind" class="task-batch">
            <div class="task-batch-heading"><strong>{{
                taskCountNames[count.kind] ?? count.kind
              }}</strong><span><b>{{ count.deletedCount }}</b> 条 <i> / {{ count.batches }} 批</i></span></div>
            <div class="task-batch-meta"><span>截止 {{ formatBeijingTime(count.cutoff ?? null) }}</span><span
                v-if="count.retentionDays">保留 {{ count.retentionDays }} 天</span><span
                :class="{ 'task-warning': count.limitReached }">{{
                count.limitReached ? '达到批次上限' : '未达上限'
              }}</span></div>
          </div>
        </div>
      </section>
      <section class="task-detail-section task-trace">
        <h3>审计关联
          <NuxtLink v-if="canReadAudit" to="/admin/logs/audit">前往操作审计 →</NuxtLink>
        </h3>
        <dl>
          <div>
            <dt>请求编号</dt>
            <dd>{{ detail.requestId }}</dd>
          </div>
          <div>
            <dt>关联组</dt>
            <dd>{{ detail.groupId }}</dd>
          </div>
        </dl>
      </section>
    </div>
    <template #actions>
      <UButton class="admin-button" @click="emit('close')">关闭</UButton>
    </template>
  </AdminCommonDialog>
</template>
<style scoped src="~/assets/admin/css/pages/task-common.css"></style>
<style scoped src="~/assets/admin/css/pages/task-detail.css"></style>
