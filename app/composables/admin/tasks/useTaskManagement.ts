// 任务确认、可见性和轮询暂停的页面接线；请求及业务状态仍归原 store。
import {storeToRefs} from 'pinia'
import {useAdminTasksStore} from '~/stores/admin/tasks'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import type {TaskRecord, TaskRunRecord} from '#shared/types/admin/tasks'
export function useTaskManagement(){
const store = useAdminTasksStore(), session = useAdminSessionStore()
const {data, pending, error, rows, search, enabled, latestStatus, stale, notification, validationError, loadFailure, canConfigure, canChangeStatus, canRun, canStop, canForceStop, canReadAudit, editing, currentTask, configurationStale, runDisabledReason, draft, previewTimes, dirty, historyTask, history, filters, page, historyBusy, detail} = storeToRefs(store)
const {edit, preview, save, showHistory, filterHistory, showDetail, closeHistory, closeDetail} = store
const busy = useAdminBusy(() => store.busy)
const confirm = useAdminActionConfirm(), route = useRoute()
const changingStatusId = ref<string | null>(null)
const unsaved = useAdminUnsavedGuard(() => store.dirty, '放弃未保存的任务配置？', () => !!store.editing,
  () => confirm.ask({title: '放弃修改？', message: '尚未保存的执行计划和保留天数将丢失。', confirmLabel: '放弃修改'}))
const ready=callOnce('admin-tasks:' + session.generation + ':' + route.fullPath, () => store.enter(), {mode: 'navigation'})
useAdminRefresh(() => store.refresh(), () => unsaved.guard())
function syncPolling() {
  store.pollingPaused = document.hidden || busy.value || !!confirm.state.value || !!changingStatusId.value
}
onMounted(() => {
  syncPolling()
  document.addEventListener('visibilitychange', syncPolling)
  store.startPolling()
})
watch([busy, confirm.state, changingStatusId], () => { if (import.meta.client) syncPolling() })
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncPolling)
  store.leave()
})
async function close() {
  if (!busy.value && await unsaved.guard()) store.closeEditor()
}
async function toggle(row: TaskRecord) {
  if (busy.value || changingStatusId.value || !store.canChangeStatus) return
  const generation = session.generation
  changingStatusId.value = row.id
  try {
    if (!await confirm.ask({title: row.enabled ? '暂停定时任务？' : '启用定时任务？',
      message: '暂停只影响后续调度，正在执行的任务需单独停止。启用后可能启动补跑。', confirmLabel: row.enabled ? '暂停' : '启用'})) return
    if (generation === session.generation) await store.toggle(row)
  } finally { changingStatusId.value = null }
}
async function run(row: TaskRecord) {
  if (busy.value || store.dirty || store.configurationStale || !store.canRun || !row.online || row.activeRun) return
  const generation = session.generation
  if (!await confirm.ask({title: '立即执行' + row.name + '？',
    message: row.description + ' 此操作会实际清理符合条件的数据，已提交批次无法撤回；暂停状态下也可手动执行一次。', confirmLabel: '立即执行'})) return
  if (generation === session.generation) await store.run(row)
}
async function control(record: TaskRunRecord, action: 'stop' | 'force') {
  if (busy.value) return
  const generation = session.generation
  if (!await confirm.ask({title: action === 'force' ? '强制终止独立任务进程？' : '停止任务？',
    message: action === 'force' ? '已提交批次保留，当前未提交事务将回滚。系统确认进程退出并取得数据库锁后才会标记终止，确认前不能重跑。' : '将在当前批次结束后停止，已提交数据不会恢复。',
    confirmLabel: action === 'force' ? '强制终止' : '停止任务'})) return
  if (generation === session.generation) await store.control(record, action)
}

return {store,data,pending,error,rows,search,enabled,latestStatus,stale,notification,validationError,loadFailure,canConfigure,canChangeStatus,canRun,canStop,canForceStop,canReadAudit,editing,currentTask,configurationStale,runDisabledReason,draft,previewTimes,dirty,historyTask,history,filters,page,historyBusy,detail,edit,preview,save,showHistory,filterHistory,showDetail,closeHistory,closeDetail,busy,confirm,changingStatusId,close,toggle,run,control,ready}
}
