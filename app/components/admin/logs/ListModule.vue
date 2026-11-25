<!-- 日志界面装配，页面交互由专属 composable 接线。 -->
<script setup lang="ts">
import {logChangeSummary} from '#shared/utils/admin/log-changes'
import LogDetailDialog from './LogDetailDialog.vue'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {Download, Search, Eye} from 'lucide-vue-next'
import SelectField from '~/components/admin/common/SelectField.vue'
import Toast from '~/components/admin/common/Toast.vue'
import RowActions from '~/components/admin/common/RowActions.vue'
import {logNames, logResultNames} from '#shared/config/admin/logs'
import {logTargetNames, logDescriptions, logPeriodItems} from '~/config/admin/logs'
import {type LogKind} from '#shared/types/admin/logs'
import {formatBeijingDateRange} from '#shared/utils/beijing-time'
import {formatBeijingTime as displayTime} from '#shared/utils/beijing-time'
import {hasSource,accountName} from '~/utils/admin/logs/presentation'
import type {LogRecord} from '#shared/types/admin/logs'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useLogManagement} from '~/composables/admin/logs/useLogManagement'
const props=defineProps<{kind:LogKind}>()
const auth=useAdminSessionStore(),preferences=useAdminPreferencesStore(),pageRoute=useRoute()
const actorId=auth.session?.user?.id??'anonymous'
await callOnce(`admin-preferences:${auth.generation}:${actorId}:${pageRoute.path}`,()=>preferences.load(actorId),{mode:'navigation'})
const {filters,pageSize,page,data,pending,loadError,toast,includeSources,sources,sourceExport,searchError,detailBusy,actionItems,resultItems,effectiveFilters,busy,applied,exportCsv,query,changePeriod,refresh,ready}=useLogManagement(props)
const detailDialog=ref<InstanceType<typeof LogDetailDialog>|null>(null)
function detail(row:LogRecord,event:Event){detailDialog.value?.show(row,event)}
await ready
</script>
<template>
  <section class="admin-module log-page log-list">
    <AdminCommonPageHeader :title="logNames[kind]" :description="logDescriptions[kind]"/>
    <section class="log-list-card" :aria-label="logNames[kind] + '列表'">
      <div class="log-list-heading"><h2>{{ logNames[kind] }}<span v-if="data" class="log-result-count">{{ data.total }} 条</span>
      </h2>
        <p>按北京时间查询，记录仅供查看</p></div>
      <form class="admin-toolbar log-filters" @submit.prevent="query(1, true)">
        <SelectField v-model="filters.period" label="日期范围" :items="logPeriodItems" :body-lock="false"
                     @change="changePeriod"/>
        <template v-if="filters.period === 'custom'"><label class="log-date">开始日期<input v-model="filters.startDate"
                                                                                            class="admin-input"
                                                                                            type="date"
                                                                                            @change="query()"></label><label
            class="log-date">结束日期<input v-model="filters.endDate" class="admin-input" type="date" @change="query()"></label>
        </template>
        <UInput v-model="filters.account" aria-label="用户名（精确匹配）" placeholder="用户名（精确匹配）"
                aria-describedby="log-account-search-help" :maxlength="64" :ui="{ base: 'admin-input' }"/>
        <UInput v-model="filters.actorId" aria-describedby="log-account-search-help" aria-label="账号 ID（精确匹配）"
                placeholder="账号 ID（精确匹配）" :maxlength="20" :ui="{ base: 'admin-input' }"/>
        <UInput v-model="filters.requestId" aria-label="请求编号（精确匹配）" placeholder="请求编号（精确匹配）"
                :maxlength="36" :ui="{ base: 'admin-input' }"/>
        <UInput v-model="filters.logId" aria-label="记录编号（精确匹配）" placeholder="记录编号（精确匹配）"
                :maxlength="20" :ui="{ base: 'admin-input' }"/>
        <SelectField v-model="filters.action" class="log-action-filter" label="操作类型" :items="actionItems"
                     :body-lock="false" @change="query()"/>
        <SelectField v-model="filters.result" label="结果筛选" :items="resultItems" :body-lock="false"
                     @change="query()"/>
        <UInput v-if="sources" v-model="filters.ip" aria-label="来源 IP（精确匹配）" placeholder="来源 IP（精确匹配）"
                :maxlength="45" :ui="{ base: 'admin-input' }"/>
        <UButton type="submit" class="admin-button" :disabled="pending">
          <Search class="log-icon" aria-hidden="true"/>
          查询
        </UButton>
      </form>
      <AdminCommonFeedback v-if="searchError" tone="error">{{ searchError }}</AdminCommonFeedback>
      <p id="log-account-search-help" class="log-search-help">
        <template v-if="kind === 'audit'">筛选执行操作的账号，不匹配操作对象。</template>
        用户名精确匹配，同名历史账号会一并查询；可通过账号 ID 区分，同时填写须同时匹配。
        按请求编号或记录编号查询时也受日期范围限制；查询历史记录请调整日期范围。
      </p>
      <div v-if="data" class="log-applied"><p>
        当前查询：{{ formatBeijingDateRange(data.range.start, data.range.endExclusive) }}</p>
        <div v-if="effectiveFilters.length" class="log-filter-tags"><span v-for="filter in effectiveFilters"
                                                                          :key="filter.key">{{ filter.text }}</span>
        </div>
      </div>
      <div v-if="auth.can(`system.logs.${kind}.export`)" class="admin-toolbar log-export-bar"><label v-if="sourceExport"><input
          v-model="includeSources" type="checkbox" :disabled="busy"> 包含来源 IP 和浏览器信息</label>
        <UButton class="admin-button admin-button-primary"
                 :disabled="busy || pending || !!loadError || !data || (!!applied().ip && !sourceExport)"
                 @click="exportCsv">
          <Download class="log-icon" aria-hidden="true"/>
          {{ busy ? '正在导出…' : '导出查询结果' }}
        </UButton>
        <span v-if="data">CSV 格式，单次最多 {{ data.exportLimit }} 条</span><span v-if="applied().ip && !sourceExport">导出包含来源筛选的结果需要来源导出权限。</span>
      </div>
      <AdminCommonDataState v-if="pending" state="loading" title="正在加载日志…"/>
      <AdminCommonDataState v-else-if="loadError" state="error" title="日志加载失败"
                            :description="loadError">
        <template #action>
          <UButton class="admin-button" @click="refresh()">重试</UButton>
        </template>
      </AdminCommonDataState>
      <AdminCommonDataState v-else-if="data && !data.items.length" state="empty" title="没有符合条件的记录"
                            description="请调整日期、事件或结果后重新查询。"/>
      <AdminCommonTable v-else-if="data" :min-width="kind === 'audit' ? (sources ? 1160 : 1000) : (sources ? 960 : 800)"
                        :label="logNames[kind] + '列表'">
        <colgroup>
          <col style="width: 205px">
          <col style="width: 160px">
          <col style="width: 185px">
          <col v-if="kind === 'audit'" style="width: 200px">
          <col style="width: 90px">
          <col v-if="sources" style="width: 160px">
          <col style="width: 110px">
        </colgroup>
        <thead>
        <tr>
          <th>发生时间</th>
          <th>{{ kind === 'audit' ? '操作账号' : '账号' }}</th>
          <th>{{ kind === 'audit' ? '操作内容' : '事件' }}</th>
          <th v-if="kind === 'audit'">操作对象</th>
          <th class="admin-table-status">结果</th>
          <th v-if="sources">来源 IP</th>
          <th class="admin-table-actions">操作</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="row in data.items" :key="row.id">
          <td class="admin-table-time">{{ displayTime(row.createdAt) }}</td>
          <td>{{ accountName(row) }}<span v-if="row.actorId" class="log-meta">账号 ID：{{ row.actorId }}</span></td>
          <td>{{ row.actionName }}<span v-if="kind === 'audit' && (row.changeSummary || row.changeContext)" class="log-meta">{{ row.changeSummary || logChangeSummary(row.changeContext) }}</span></td>
          <td v-if="kind === 'audit'"><span v-if="row.targetName">{{ row.targetName }}</span><span v-if="row.targetType"
                                                                                                   class="log-meta">{{
              logTargetNames[row.targetType] ?? row.targetType
            }}<template v-if="row.targetId"> · ID：{{ row.targetId }}</template></span></td>
          <td class="admin-table-status"><span class="log-result" :class="'log-result-' + row.result">{{
              logResultNames[row.result]
            }}</span></td>
          <td v-if="sources" class="log-source">{{ hasSource(row.ip) ? row.ip : '—' }}</td>
          <td class="admin-table-actions">
            <RowActions>
              <UButton class="admin-button" :disabled="detailBusy" @click="detail(row, $event)">
                <Eye class="log-icon" aria-hidden="true"/>
                详情
              </UButton>
            </RowActions>
          </td>
        </tr>
        </tbody>
      </AdminCommonTable>
      <div v-if="data" class="admin-toolbar admin-pagination log-pagination"><span>共 {{ data.total }} 条，第 {{ page }} 页</span>
        <SelectField v-model="pageSize" label="每页条数"
                     :items="ADMIN_PAGE_SIZES.map(size => ({ label: `${size} 条`, value: String(size) }))"
                     :body-lock="false" @change="query()"/>
        <UButton class="admin-button" :disabled="pending || page <= 1" @click="query(page - 1)">上一页</UButton>
        <UButton class="admin-button" :disabled="pending || page * data.pageSize >= data.total"
                 @click="query(page + 1)">下一页
        </UButton>
      </div>
    </section>
    <LogDetailDialog ref="detailDialog" :kind="kind"/>
    <Toast :notification="toast?{message:toast.message,tone:toast.status}:null" @dismiss="toast = null"/>
  </section>
</template>
<style src="~/assets/admin/css/pages/logs.css"></style>
