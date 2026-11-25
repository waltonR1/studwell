<!-- 页面只装配展示和 DOM 生命周期；业务快照与轮询由 store 持有。 -->
<script setup lang="ts">
import {Cpu, MemoryStick, Clock, Monitor} from 'lucide-vue-next'
import {storeToRefs} from 'pinia'
import {useAdminEnvironmentStore} from '~/stores/admin/environment'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {environmentBytes as bytes, environmentDuration as duration} from '~/utils/admin/environment'
import {formatBeijingTime} from '#shared/utils/beijing-time'

const store = useAdminEnvironmentStore(), session = useAdminSessionStore(), route = useRoute()
const {data, pending, error, stale, pollingPaused} = storeToRefs(store)
function syncVisibility() { pollingPaused.value = document.hidden }
await callOnce('admin-environment:' + session.generation + ':' + route.fullPath, () => store.enter(), {mode: 'navigation'})
useAdminRefresh(() => store.refresh())
onMounted(() => {
  syncVisibility()
  document.addEventListener('visibilitychange', syncVisibility)
  store.startPolling()
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncVisibility)
  store.leave()
})
</script>

<template>
  <section class="admin-module environment-page">
    <AdminCommonPageHeader title="系统环境" description="查看当前实例的 CPU、内存及运行状态。"/>
    <div class="environment-toolbar">
      <p v-if="data">采样时间：{{ formatBeijingTime(data.sampledAt) }}</p>
      <p>{{ pollingPaused ? '页面隐藏，自动刷新已暂停' : '每 10 秒自动刷新' }}</p>
    </div>
    <AdminCommonFeedback v-if="error" tone="error">{{ error }}</AdminCommonFeedback>
    <AdminCommonFeedback v-if="stale" tone="warning">刷新失败，以下为上次成功采样的数据，请留意采样时间。</AdminCommonFeedback>
    <AdminCommonDataState v-if="pending && !data" state="loading" title="正在读取系统环境…"/>
    <AdminCommonDataState v-else-if="!data && !error" state="empty" title="暂无可查看的系统环境数据"/>
    <template v-if="data">
      <p class="environment-scope"><Monitor class="environment-icon" aria-hidden="true"/>当前实例 {{ data.instanceId.slice(0, 8) }} · 系统指标为操作系统可见资源；容器和多实例部署时，不代表全部服务器或容器配额。</p>
      <div class="environment-grid">
        <article class="environment-card">
          <div class="environment-heading"><h2>CPU 使用率</h2><Cpu aria-hidden="true"/></div>
          <p class="environment-value">{{ data.cpu.usagePercent === null ? (data.cpu.status === 'sampling' ? '采样中' : '暂不可用') : `${data.cpu.usagePercent}%` }}</p>
          <meter v-if="data.cpu.usagePercent !== null" :value="data.cpu.usagePercent" min="0" max="100" aria-label="CPU 使用率"/>
          <p class="environment-note">{{ data.cpu.sampleWindowMs === null ? '等待两次有效采样后计算使用率。' : `最近约 ${Math.round(data.cpu.sampleWindowMs / 1000)} 秒的平均使用率。` }}</p>
          <dl class="environment-facts">
            <div><dt>处理器</dt><dd>{{ data.cpu.model || '暂不可用' }}</dd></div>
            <div><dt>逻辑核心</dt><dd>{{ data.cpu.logicalCores ?? '—' }}</dd></div>
            <div><dt>建议并行度</dt><dd>{{ data.cpu.availableParallelism }}</dd></div>
          </dl>
        </article>
        <article class="environment-card">
          <div class="environment-heading"><h2>系统内存</h2><MemoryStick aria-hidden="true"/></div>
          <p class="environment-value">{{ data.memory.occupiedPercent === null ? '暂不可用' : `${data.memory.occupiedPercent}%` }}</p>
          <meter v-if="data.memory.occupiedPercent !== null" :value="data.memory.occupiedPercent" min="0" max="100" aria-label="系统内存占用比例"/>
          <p class="environment-note">按总量减空闲量计算，包含缓存等占用，不能直接视为内存不足。</p>
          <dl class="environment-facts">
            <div><dt>总内存</dt><dd>{{ bytes(data.memory.totalBytes) }}</dd></div>
            <div><dt>空闲内存</dt><dd>{{ bytes(data.memory.freeBytes) }}</dd></div>
            <div><dt>已占用（含缓存）</dt><dd>{{ bytes(data.memory.occupiedBytes) }}</dd></div>
          </dl>
        </article>
        <article class="environment-card">
          <div class="environment-heading"><h2>网站进程内存</h2><MemoryStick aria-hidden="true"/></div>
          <p class="environment-value">{{ bytes(data.application.rssBytes) }}</p>
          <p class="environment-note">当前网站进程的驻留内存（RSS），不包含 MySQL、独立任务进程或其他实例。</p>
          <dl class="environment-facts">
            <div><dt>JS 堆已用</dt><dd>{{ bytes(data.application.heapUsedBytes) }}</dd></div>
            <div><dt>JS 堆已分配</dt><dd>{{ bytes(data.application.heapAllocatedBytes) }}</dd></div>
            <div><dt>JS 堆上限</dt><dd>{{ bytes(data.application.heapLimitBytes) }}</dd></div>
            <div><dt>运行时报告的内存限制</dt><dd>{{ data.application.constrainedMemoryBytes === null ? '未报告限制' : bytes(data.application.constrainedMemoryBytes) }}</dd></div>
          </dl>
        </article>
      </div>
      <section class="environment-card environment-runtime" aria-labelledby="environment-runtime-title">
        <div class="environment-heading"><h2 id="environment-runtime-title">运行环境</h2><Clock aria-hidden="true"/></div>
        <dl class="environment-facts environment-runtime-facts">
          <div><dt>操作系统</dt><dd>{{ data.system.type }} {{ data.system.release }}</dd></div>
          <div><dt>架构</dt><dd>{{ data.system.arch }}</dd></div>
          <div><dt>Node.js</dt><dd>{{ data.application.nodeVersion }}</dd></div>
          <div><dt>系统运行时长</dt><dd>{{ duration(data.system.uptimeSeconds) }}</dd></div>
          <div><dt>网站进程运行时长</dt><dd>{{ duration(data.application.uptimeSeconds) }}</dd></div>
        </dl>
        <p class="environment-note">系统运行时长来自操作系统；网站重启会重置进程运行时长。不同实例的运行状态分别计量。</p>
      </section>
    </template>
  </section>
</template>

<style src="~/assets/admin/css/pages/environment.css"></style>
