<!-- 日志详情展示，详情读取由日志 store 持有，复制与焦点归组件。 -->
<script setup lang="ts">
import LogChanges from './LogChanges.vue'
import {Copy} from 'lucide-vue-next'
import {logNames, logResultNames, logReasonNames, rateLimitNames} from '#shared/config/admin/logs'
import {logTargetNames} from '~/config/admin/logs'
import {type LogKind} from '#shared/types/admin/logs'
import {useAdminLogsStore} from '~/stores/admin/logs'
import {storeToRefs} from 'pinia'
import type {LogRecord} from '#shared/types/admin/logs'
import {formatBeijingTime as displayTime} from '#shared/utils/beijing-time'
import {hasSource, accountName} from '~/utils/admin/logs/presentation'
defineProps<{kind: LogKind}>()
const store = useAdminLogsStore()
const {sources, open, selected, detailBusy, detailError, exportFilterRows} = storeToRefs(store)
const copyError = ref(''), copied = ref<'requestId' | 'id' | ''>(''), technicalOpen = ref(false)
let trigger: HTMLElement | null = null, revision = 0
function resetCopy() { revision++; copyError.value = ''; copied.value = ''; technicalOpen.value = false }
async function show(row: LogRecord, event: Event) {
  resetCopy()
  trigger = event.currentTarget as HTMLElement
  await store.openDetail(row)
}
async function closeDetail() {
  resetCopy()
  store.closeDetail()
  await nextTick()
  if (trigger?.isConnected) trigger.focus()
}
async function copy(field: 'requestId' | 'id') {
  if (!selected.value) return
  const request = revision, id = selected.value.id
  technicalOpen.value = true
  copyError.value = ''
  copied.value = ''
  try {
    await navigator.clipboard.writeText(selected.value[field])
    if (request === revision && selected.value?.id === id) copied.value = field
  } catch {
    if (request === revision && selected.value?.id === id) copyError.value = '复制失败，请手动选择编号。'
  }
}
watch([open, () => selected.value?.id], resetCopy)
onBeforeUnmount(() => { revision++; trigger = null })
defineExpose({show})
</script>
<template>
  <AdminCommonDialog :open="open" :title="logNames[kind] + '详情'" @close="closeDetail">
    <AdminCommonDataState v-if="detailBusy" state="loading" title="正在加载日志详情…"/>
    <AdminCommonDataState v-else-if="detailError" state="error" title="详情加载失败" :description="detailError"/>
    <div v-if="selected" class="log-detail-list">
      <div class="log-detail-summary"><span class="log-detail-event">{{ selected.actionName }}</span><span
          class="log-result" :class="'log-result-' + selected.result">{{
          logResultNames[selected.result]
        }}</span></div>
      <dl class="log-facts">
        <div v-if="selected.reasonCode && logReasonNames[selected.reasonCode as keyof typeof logReasonNames]">
          <dt>原因</dt>
          <dd>{{ logReasonNames[selected.reasonCode as keyof typeof logReasonNames] }}</dd>
        </div>
        <div>
          <dt>发生时间</dt>
          <dd>{{ displayTime(selected.createdAt) }}</dd>
        </div>
        <div>
          <dt>{{ kind === 'audit' ? '操作账号' : '账号' }}</dt>
          <dd>{{ accountName(selected) }}</dd>
        </div>
        <div v-if="selected.actorId">
          <dt>账号 ID</dt>
          <dd>{{ selected.actorId }}</dd>
        </div>
      </dl>
      <section v-if="kind === 'audit' && (selected.targetType || selected.targetName)" class="log-detail-section"
               aria-label="操作对象">
        <h3>操作对象</h3>
        <dl class="log-facts">
          <div v-if="selected.targetType">
            <dt>类型</dt>
            <dd>{{ logTargetNames[selected.targetType] ?? selected.targetType }}</dd>
          </div>
          <div v-if="selected.targetName">
            <dt>名称</dt>
            <dd>{{ selected.targetName }}</dd>
          </div>
          <div v-if="selected.targetId">
            <dt>{{ selected.targetType === 'user' ? '账号 ID' : '对象 ID' }}</dt>
            <dd>{{ selected.targetId }}</dd>
          </div>
        </dl>
      </section>
      <LogChanges v-if="kind === 'audit' && selected.changeContext" :context="selected.changeContext"/>
      <p v-else-if="kind === 'audit' && !detailBusy && selected.result === 'success' && !selected.cleanupContext && !selected.exportContext" class="log-meta">该记录未保存变更明细。</p>
      <section v-if="selected.cleanupContext" class="log-detail-section" aria-label="清理信息">
        <h3>清理信息</h3>
        <dl class="log-facts">
          <div>
            <dt>日志类型</dt>
            <dd>{{ logNames[selected.cleanupContext.kind] }}</dd>
          </div>
          <div>
            <dt>保留天数</dt>
            <dd>{{ selected.cleanupContext.retentionDays }} 天（含当天）</dd>
          </div>
          <div>
            <dt>清理截止时间</dt>
            <dd>{{ displayTime(selected.cleanupContext.cutoff) }} 之前</dd>
          </div>
          <div>
            <dt>本批删除数量</dt>
            <dd>{{ selected.cleanupContext.deletedCount }} 条</dd>
          </div>
          <div>
            <dt>执行批次</dt>
            <dd>第 {{ selected.cleanupContext.batch }} 批</dd>
          </div>
          <div v-if="selected.cleanupContext.limitReached">
            <dt>处理情况</dt>
            <dd>已达到本次任务批次上限；如有剩余记录，将在下次任务继续处理。</dd>
          </div>
        </dl>
      </section>
      <section v-if="selected.exportContext" class="log-detail-section" aria-label="导出信息">
        <h3>导出信息</h3>
        <dl class="log-facts">
          <div>
            <dt>日志类型</dt>
            <dd>{{ logNames[selected.exportContext.kind] }}</dd>
          </div>
          <div>
            <dt>导出条数</dt>
            <dd>{{ selected.exportContext.rowCount }} 条</dd>
          </div>
          <div>
            <dt>开始时间</dt>
            <dd>{{ displayTime(selected.exportContext.start) }}</dd>
          </div>
          <div>
            <dt>结束时间（不含）</dt>
            <dd>{{ displayTime(selected.exportContext.endExclusive) }}</dd>
          </div>
          <div>
            <dt>包含来源信息</dt>
            <dd>{{ selected.exportContext.includeSources ? '是' : '否' }}</dd>
          </div>
        </dl>
        <template v-if="exportFilterRows.length"><h4 class="log-detail-subheading">筛选条件</h4>
          <dl class="log-facts">
            <div v-for="filter in exportFilterRows" :key="filter.label">
              <dt>{{ filter.label }}</dt>
              <dd>{{ filter.value }}</dd>
            </div>
          </dl>
        </template>
      </section>
      <p v-if="selected.exportContextHidden" class="log-meta">部分导出条件已按权限隐藏。</p>
      <section
          v-if="kind === 'security' && (selected.routeTemplate || selected.permissionCode || selected.rateLimitScope)"
          class="log-detail-section" aria-label="触发信息">
        <h3>触发信息</h3>
        <dl class="log-facts">
          <div v-if="selected.routeTemplate">
            <dt>接口</dt>
            <dd><span v-if="selected.requestMethod">{{ selected.requestMethod }} </span>{{ selected.routeTemplate }}
            </dd>
          </div>
          <div v-if="selected.permissionCode">
            <dt>所需权限</dt>
            <dd>{{ selected.permissionCode }}</dd>
          </div>
          <div v-if="selected.rateLimitScope && rateLimitNames[selected.rateLimitScope]">
            <dt>限制范围</dt>
            <dd>{{ rateLimitNames[selected.rateLimitScope] }}</dd>
          </div>
        </dl>
      </section>
      <details :open="technicalOpen" class="log-technical"
               @toggle="technicalOpen = ($event.target as HTMLDetailsElement).open">
        <summary>技术信息</summary>
        <dl class="log-facts">
          <div v-if="selected.requestId">
            <dt>请求编号</dt>
            <dd>
              <div class="log-request-id"><span class="log-context">{{ selected.requestId }}</span>
                <button type="button" class="log-copy-button" aria-label="复制请求编号" @click="copy('requestId')">
                  <Copy class="log-icon" aria-hidden="true"/>
                  复制
                </button>
              </div>
              <p v-if="copied === 'requestId'" class="log-copy-success" role="status">已复制。</p></dd>
          </div>
          <div v-if="sources && hasSource(selected.ip)">
            <dt>来源 IP</dt>
            <dd>{{ selected.ip }}</dd>
          </div>
          <div v-if="sources && selected.userAgent && selected.userAgent !== 'unknown'">
            <dt>浏览器信息（User-Agent）</dt>
            <dd class="log-context">{{ selected.userAgent }}</dd>
          </div>
          <div>
            <dt>记录编号</dt>
            <dd><div class="log-request-id"><span class="log-context">{{ selected.id }}</span>
              <button type="button" class="log-copy-button" aria-label="复制记录编号" @click="copy('id')">
                <Copy class="log-icon" aria-hidden="true"/>复制
              </button></div><p v-if="copied === 'id'" class="log-copy-success" role="status">已复制。</p></dd>
          </div>
          <div v-if="selected.reasonCode">
            <dt>原因编码</dt>
            <dd>{{ selected.reasonCode }}</dd>
          </div>
          <div v-if="selected.action">
            <dt>事件编码</dt>
            <dd>{{ selected.action }}</dd>
          </div>
        </dl>
        <p v-if="copyError" class="admin-field-error" role="alert">{{ copyError }}</p>
      </details>
    </div>
    <template #actions>
      <UButton class="admin-button admin-button-primary" @click="closeDetail">关闭</UButton>
    </template>
  </AdminCommonDialog>
</template>
