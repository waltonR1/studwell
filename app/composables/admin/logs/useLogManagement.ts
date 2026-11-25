// 日志查询同步与浏览器下载的页面接线；请求及业务状态仍归原 store。
import type {LogKind} from '#shared/types/admin/logs'
import {useAdminLogsStore} from '~/stores/admin/logs'
import type {AdminLogQuery} from '~/types/admin/logs'
import {storeToRefs} from 'pinia'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'

export function useLogManagement(props:{readonly kind:LogKind}){
const auth = useAdminSessionStore(), preferences = useAdminPreferencesStore()
const actorId = auth.session?.user?.id ?? 'anonymous'
const pageRoute = useRoute()
const store = useAdminLogsStore()
const {filters, pageSize, page, data, pending, loadError, feedback: toast, includeSources,
  sources, sourceExport, searchError, detailBusy, actionItems, resultItems, effectiveFilters} = storeToRefs(store)
const busy = useAdminBusy(() => store.busy)
const {applied} = store
async function exportCsv() {
  const file = await store.exportCsv()
  if (!file) return
  let url: string | undefined
  const link = document.createElement('a')
  try {
    url = URL.createObjectURL(file.blob)
    link.href = url
    link.download = file.filename
    document.body.appendChild(link)
    link.click()
  } catch {
    store.feedback = {message: 'CSV 已生成，但浏览器下载失败，请重试。', status: 'error'}
  } finally {
    link.remove()
    if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000)
  }
}

async function query(next = 1, applyText = false) {
  const values = store.buildQuery(next, applyText)
  if (values) await navigateTo({path: '/admin/logs/' + props.kind, query: values})
}
async function changePeriod() { store.changePeriod(); await query() }
async function refresh() { await store.refresh().catch(() => {}) }
const normalizedQuery = computed(() => Object.fromEntries(Object.entries(pageRoute.query)
  .map(([key, value]) => [key, Array.isArray(value) ? value[0] ?? undefined : value ?? undefined])) as AdminLogQuery)
const ready=callOnce('admin-logs:' + auth.generation + ':' + props.kind + ':' + pageRoute.fullPath,
  () => store.enter(props.kind, normalizedQuery.value, preferences.pageSize(actorId)), {mode: 'navigation'})
watch([() => props.kind, normalizedQuery], () => store.enter(props.kind, normalizedQuery.value, preferences.pageSize(actorId)), {deep: true})
useAdminRefresh(() => store.refresh())
onBeforeUnmount(() => store.leave())

return {auth,actorId,filters,pageSize,page,data,pending,loadError,toast,includeSources,sources,sourceExport,searchError,detailBusy,actionItems,resultItems,effectiveFilters,busy,applied,exportCsv,query,changePeriod,refresh,ready}
}
