// 咨询列表交互编排：查询、详情、通知和浏览器可见性接线；业务数据及轮询执行归 store。
import {statusOptions} from '~/config/admin/inquiry-list'
import {storeToRefs} from 'pinia'
import {ADMIN_PAGE_SIZES} from '#shared/config/admin/pagination'
import {isEntityIdInRange} from '#shared/schemas/entity'
import {useAdminInquiriesStore} from '~/stores/admin/inquiries'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useInquiryListQuery} from '~/composables/admin/inquiries/useInquiryListQuery'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import type {AdminOperationResult} from '~/types/admin/action-result'

export function useInquiryManagement(){
const route = useRoute(), store = useAdminInquiriesStore()
const session = useAdminSessionStore(), preferences = useAdminPreferencesStore()
const actorId = session.session?.user?.id ?? 'anonymous'
const defaultPageSize = ADMIN_PAGE_SIZES.find(size => size === preferences.pageSize(actorId)) ?? 20
const listQuery = useInquiryListQuery('/admin/inquiries', defaultPageSize)
const {search, queue, status, category, assigneeId:assigneeFilter, from, to, pageSize} = toRefs(listQuery.draft)
const filterError = listQuery.filterError, page = listQuery.page
const {
  listError, warning, list, loading,
  selected, detail, assignees, detailPending, detailError, detailVisible, detailStale, submitErrors,
  nextStatus, assignee, note, repliedExternally, reply, closingDelivery, closeReason, identity, canRead, writable, canAssign, canSend,
  canReply, awaitingDelivery, canClaim, changed, dirty} = storeToRefs(store)
const {
  enter, refreshList, open, beginMailClose, cancelMailClose, startDeliveryPolling, stopDeliveryPolling,
  saveAssignment: persistAssignment, saveNote: persistNote, sendReply: persistReply, retryMail: persistRetry, closeMailIssue: persistClose,
} = store
const busy = useAdminBusy(() => store.busy || store.detailPending)
const unsaved = useAdminUnsavedGuard(dirty, '放弃未保存的咨询处理内容？', detailVisible)
const toast = useAdminToast()
const detailStatusOptions = computed(() => statusOptions.map(item => ({
  ...item, disabled:item.value === 'waiting_customer' && !detail.value?.inquiry.canWaitForCustomer,
})))
const assigneeOptions = computed(() => {
  const options = [{value:'',label:'未分派'}, ...assignees.value.map(user => ({value:user.id,label:user.name}))]
  const current = detail.value?.inquiry
  if (current?.assigneeId && !options.some(option => option.value === current.assigneeId))
    options.push({value:current.assigneeId,label:current.assigneeName || current.assigneeId})
  return options
})

function openFromRoute() {
  const id = route.query.id
  if (typeof id === 'string' && isEntityIdInRange(id)) void open(id)
}

async function loadQuery(query: typeof listQuery.apiQuery.value) {
  if (!canRead.value) return
  await enter(query)
  const current = list.value
  if (current && current.page !== page.value)
    await listQuery.goToPage(current.page)
}

const ready=callOnce(
  `admin-inquiries:${session.generation}:${route.fullPath}`,
  () => loadQuery(listQuery.apiQuery.value),
  {mode:'navigation'},
).then(openFromRoute)
watch(() => listQuery.apiQuery.value, query => {
  void loadQuery(query)
}, {deep:true})

function syncDeliveryPolling() {
  if(typeof document==='undefined')return
  store.deliveryPollingPaused = document.hidden || busy.value || !detailVisible.value
}

onMounted(() => {
  document.addEventListener('visibilitychange', syncDeliveryPolling)
  startDeliveryPolling()
  syncDeliveryPolling()
})
watch([identity, canRead], () => {
  toast.dismiss()
  void loadQuery(listQuery.apiQuery.value)
  openFromRoute()
})
watch(() => list.value?.page, next => {
  if (next && next !== page.value) void listQuery.goToPage(next)
})
watch([busy, detailVisible], syncDeliveryPolling)
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncDeliveryPolling)
  stopDeliveryPolling()
  store.leave()
  toast.dismiss()
})
useAdminRefresh(async () => {
  store.clearDetail()
  await refreshList()
}, unsaved.guard)

async function showResult(pendingResult: Promise<AdminOperationResult | null> | undefined) {
  if (!pendingResult) return
  const notification = await pendingResult
  if (notification) toast.show(notification.message, notification.status)
}

const saveAssignment = (claim = false) => showResult(persistAssignment(claim))
const saveNote = () => showResult(persistNote())
const sendReply = () => showResult(persistReply())
const retryMail = (id: string) => showResult(persistRetry(id))
const closeMailIssue = () => showResult(persistClose())

async function closeDetail() {
  if (!busy.value && await unsaved.guard()) store.clearDetail()
}

return {listQuery,search,queue,status,category,assigneeFilter,from,to,pageSize,filterError,page,listError,warning,list,loading,selected,detail,assignees,detailPending,detailError,detailVisible,detailStale,submitErrors,nextStatus,assignee,note,repliedExternally,reply,closingDelivery,closeReason,identity,writable,canAssign,canSend,canReply,awaitingDelivery,canClaim,changed,refreshList,open,beginMailClose,cancelMailClose,busy,toast,detailStatusOptions,assigneeOptions,saveAssignment,saveNote,sendReply,retryMail,closeMailIssue,closeDetail,ready}
}
