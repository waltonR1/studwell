<!-- 定时任务TaskConfigDialog：展示所属区块，通过事件交由页面协调操作。 -->
<script setup lang="ts">
import {Clock3} from 'lucide-vue-next'
import SelectField from '~/components/admin/common/SelectField.vue'
import type {AdminTaskDraft} from '~/types/admin/tasks'
import type {TaskRecord, TaskRunRecord} from '#shared/types/admin/tasks'
import {runStatusNames} from '#shared/config/admin/tasks'
import {formatBeijingTime} from '#shared/utils/beijing-time'
import {TASK_INTERVAL_MINUTES, TASK_RETENTION_DAYS, TASK_CRON_MAX_LENGTH} from '#shared/config/admin/tasks'

defineProps<{
  editing: TaskRecord | null;
  currentTask: TaskRecord | null;
  busy: boolean;
  canConfigure: boolean;
  canRun: boolean;
  canStop: boolean;
  canForceStop: boolean;
  validationError: string;
  configurationStale: boolean;
  runDisabledReason: string;
  previewTimes: string[];
  dirty: boolean
}>()
const draft = defineModel<AdminTaskDraft>('draft', {required: true})
const emit = defineEmits<{
  close: [];
  save: [];
  preview: [];
  run: [row: TaskRecord];
  control: [run: TaskRunRecord, action: 'stop' | 'force']
}>()
</script>
<template>
  <AdminCommonDialog :open="!!editing"
                     :title="editing ? `${canConfigure ? '配置' : '查看'}${editing.name}` : '任务详情'"
                     description="修改配置只影响后续执行；立即执行使用已保存配置。" size="medium" :busy="busy"
                     @close="emit('close')">
    <AdminCommonFeedback v-if="validationError" tone="error">{{ validationError }}</AdminCommonFeedback>
    <AdminCommonFeedback v-if="configurationStale" tone="warning">
      配置已被其他操作更新，请关闭后重新打开，避免使用旧配置执行。
    </AdminCommonFeedback>
    <div class="task-editor">
      <section v-if="currentTask" class="task-form-section task-overview"><h3>
        任务信息<span>{{ currentTask.enabled ? '启用' : '暂停' }}</span></h3>
        <p class="task-snapshot-plan">{{ currentTask.description }}</p>
        <dl class="task-info-facts">
          <div>
            <dt>任务编码</dt>
            <dd>{{ currentTask.code }}</dd>
          </div>
          <div>
            <dt>调度器</dt>
            <dd>{{ currentTask.online ? '在线' : currentTask.executionAllowed ? '离线' : '当前环境禁止执行' }}</dd>
          </div>
          <div>
            <dt>配置同步</dt>
            <dd>{{ currentTask.version === currentTask.appliedVersion ? '已应用' : '等待应用' }}</dd>
          </div>
          <div>
            <dt>下次执行</dt>
            <dd>{{ formatBeijingTime(currentTask.nextRunAt) }}</dd>
          </div>
        </dl>
        <p v-if="currentTask.activeRun" class="task-field-help task-warning">{{
            currentTask.activeRun.pendingControl === 'force' ? '终止中，等待事务确认' : currentTask.activeRun.pendingControl === 'stop' ? '停止中，等待批次完成' : runStatusNames[currentTask.activeRun.status]
          }}</p></section>
      <section class="task-form-section"><h3>执行计划<span>北京时间 UTC+8</span></h3>
        <div class="task-form-grid">
          <div class="task-field"><label>执行方式</label>
            <SelectField v-model="draft.mode" label="执行方式" :disabled="busy || !canConfigure" :body-lock="false"
                         :items="[{ label: '每天', value: 'daily' }, { label: '固定间隔', value: 'interval' }, { label: 'Cron', value: 'cron' }]"/>
          </div>
          <label v-if="draft.mode === 'daily'" class="task-field">执行时间<input v-model="draft.time"
                                                                                 class="admin-input" type="time"
                                                                                 :disabled="busy || !canConfigure"></label>
          <label v-if="draft.mode === 'interval'" class="task-field">间隔分钟
            <div class="task-input-unit"><input v-model.number="draft.minutes" class="admin-input" type="number" :min="TASK_INTERVAL_MINUTES.min"
                                                :max="TASK_INTERVAL_MINUTES.max" :disabled="busy || !canConfigure"><span>分钟</span></div>
          </label>
          <label v-if="draft.mode === 'cron'" class="task-field task-field-full">五字段 Cron<input
              v-model="draft.expression" class="admin-input task-monospace" placeholder="0 3 * * *"
              :maxlength="TASK_CRON_MAX_LENGTH" :disabled="busy || !canConfigure"><span class="task-field-help">分 · 时 · 日 · 月 · 周；日和周同时限定时按 OR 匹配。认证清理最小5分钟，其余任务60分钟；含跨午夜的保守间隔校验。</span></label>
        </div>
      </section>
      <section v-if="editing?.retention" class="task-form-section"><h3>
        日志保留策略<span>超出保留期的记录将分批清理</span></h3>
        <div class="task-retention-grid">
          <label class="task-field">登录日志
            <div class="task-input-unit"><input v-model.number="draft.login" class="admin-input" type="number" :min="TASK_RETENTION_DAYS.min"
                                                :max="TASK_RETENTION_DAYS.max" :disabled="busy || !canConfigure"><span>天</span></div>
          </label>
          <label class="task-field">操作审计
            <div class="task-input-unit"><input v-model.number="draft.audit" class="admin-input" type="number" :min="TASK_RETENTION_DAYS.min"
                                                :max="TASK_RETENTION_DAYS.max" :disabled="busy || !canConfigure"><span>天</span></div>
          </label>
          <label class="task-field">安全日志
            <div class="task-input-unit"><input v-model.number="draft.security" class="admin-input" type="number"
                                                :min="TASK_RETENTION_DAYS.min" :max="TASK_RETENTION_DAYS.max" :disabled="busy || !canConfigure"><span>天</span>
            </div>
          </label>
        </div>
        <p class="task-field-help">允许{{ TASK_RETENTION_DAYS.min }}～{{ TASK_RETENTION_DAYS.max }}天，已提交的清理操作无法撤回。</p></section>
      <section class="task-preview">
        <div class="task-preview-heading">
          <h3>
            <Clock3 aria-hidden="true"/>
            执行时间预览
          </h3>
          <UButton class="admin-button" :disabled="busy" @click="emit('preview')">预览未来5次</UButton>
        </div>
        <ol v-if="previewTimes.length">
          <li v-for="(value, index) in previewTimes" :key="value"><span>{{ String(index + 1).padStart(2, '0') }}</span>
            <time>{{ formatBeijingTime(value) }}</time>
          </li>
        </ol>
        <p v-else>根据当前配置预览未来5次计划时间，不会实际执行任务。</p></section>
      <p v-if="canRun && runDisabledReason" class="task-field-help task-warning">{{ runDisabledReason }}</p>
    </div>
    <template #actions>
      <div class="task-dialog-controls">
        <UButton v-if="currentTask && canRun" class="admin-button" :disabled="busy || !!runDisabledReason"
                 @click="emit('run', currentTask)">立即执行
        </UButton>
        <UButton v-if="currentTask?.activeRun && canStop" class="admin-button"
                 :disabled="busy || !currentTask.executionAllowed || !!currentTask.activeRun.pendingControl"
                 @click="emit('control', currentTask.activeRun, 'stop')">停止
        </UButton>
        <UButton v-if="currentTask?.activeRun && canForceStop" class="admin-button task-force-button"
                 :disabled="busy || !currentTask.executionAllowed || currentTask.activeRun.pendingControl === 'force'"
                 @click="emit('control', currentTask.activeRun, 'force')">强制终止
        </UButton>
      </div>
      <UButton class="admin-button" :disabled="busy" @click="emit('close')">{{
          canConfigure ? '取消' : '关闭'
        }}
      </UButton>
      <UButton v-if="canConfigure" class="admin-button admin-button-primary" :disabled="busy || !dirty"
               @click="emit('save')">保存配置
      </UButton>
    </template>
  </AdminCommonDialog>
</template>
<style scoped src="~/assets/admin/css/pages/task-common.css"></style>
<style scoped src="~/assets/admin/css/pages/task-config.css"></style>
