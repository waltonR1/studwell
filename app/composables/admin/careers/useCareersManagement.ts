// 招聘管理交互接线：查询、确认通知、排序及生命周期；岗位草稿和请求由 careers store 管理。
import {adminContentLocale} from '#shared/config/site-languages'
import {storeToRefs} from 'pinia'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'
import {useAdminCareersStore} from '~/stores/admin/careers'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminSessionStore} from '~/stores/admin/session'
import {careerLocales, type AdminCareerPosition} from '#shared/schemas/admin/careers'
import type {AdminOperationResult} from '~/types/admin/action-result'

export function useCareersManagement(){
const store = useAdminCareersStore()
const session = useAdminSessionStore()
const preferences = useAdminPreferencesStore()
const toast = useAdminToast()
const confirmation = useAdminActionConfirm()
const route = useRoute()
const actorId = session.session?.user?.id ?? 'anonymous'
const listQuery = useAdminListQuery({
  path: '/admin/careers/positions',
  filterKey: 'status',
  filterValues: ['published', 'unpublished'],
  defaultPageSize: preferences.pageSize(actorId),
})
const {search, filter: statusFilter, pageSize} = toRefs(listQuery.draft)
const page = listQuery.page
const {list, items, total, draft, busy, saveError, dirty} = storeToRefs(store)
const pending = computed(() => list.value.pending)
const error = computed(() => list.value.error)
const warning = computed(() => list.value.warning)
const locale = ref<(typeof careerLocales)[number]>(adminContentLocale)
const writable = computed(() => session.can('content.careers.update'))
const publishable = computed(() => session.can('content.careers.publish'))
const statusLabel = (item: AdminCareerPosition) => item.publishedReleaseId ? '已发布' : '未发布'
const filtered = computed(() => !!listQuery.applied.value.search || !!listQuery.applied.value.filter)
const sortRows = computed(() => items.value.map(position => ({
  id: position.id,
  name: position.content.localized[adminContentLocale]?.title || '未命名岗位',
  visible: true,
  position,
})))
const guard = useAdminUnsavedGuard(() => dirty.value, '岗位内容尚未保存。')
useAdminBusy(() => busy.value)
onBeforeRouteLeave(() => !busy.value)

async function notify(pendingResult: Promise<AdminOperationResult | null> | null) {
  if (!pendingResult) return
  const notification = await pendingResult
  if (notification) toast.show(notification.message, notification.status)
}

function edit(item?: AdminCareerPosition) {
  store.edit(item)
  locale.value = adminContentLocale
}


async function close() {
  if (!busy.value && await guard.guard()) store.close()
}

async function changeState(position: AdminCareerPosition, action: 'publish' | 'withdraw') {
  if (!position.id || !publishable.value) return
  const label = action === 'publish' ? '发布' : '下线'
  const accepted = await confirmation.ask({
    title: `${label}岗位？`,
    message: action === 'publish'
      ? `发布后，“${position.content.localized[adminContentLocale]?.title || '未命名岗位'}”将显示在官网招聘列表中。`
      : `下线后，“${position.content.localized[adminContentLocale]?.title || '未命名岗位'}”将不再显示在官网招聘列表中，历史发布内容保留。`,
    confirmLabel: label,
    cancelLabel: '取消',
  })
  if (accepted) await notify(store.changeState(position, action))
}

function canMove(row: (typeof sortRows.value)[number], direction: 'up' | 'down') {
  if (filtered.value) return false
  const index = sortRows.value.findIndex(item => item.id === row.id)
  return direction === 'up' ? index > 0 : index >= 0 && index < sortRows.value.length - 1
}

async function movePosition(row: (typeof sortRows.value)[number], direction: 'up' | 'down') {
  const index = sortRows.value.findIndex(item => item.id === row.id)
  const neighbor = sortRows.value[index + (direction === 'up' ? -1 : 1)]
  if (!neighbor || !canMove(row, direction)) return
  await notify(store.move(row.position, neighbor.position, direction))
}

useAdminRefresh(
  () => store.refreshList(),
  async () => !busy.value && await guard.guard(),
)

const ready=callOnce(
  `admin-careers:${session.generation}:${route.fullPath}`,
  () => store.enterList(listQuery.apiQuery.value),
  {mode: 'navigation'},
)
watch(() => listQuery.apiQuery.value, next => store.enterList(next), {deep: true})
watch(() => session.generation, () => toast.dismiss())
onBeforeUnmount(() => {
  store.leaveList()
  toast.dismiss()
})

function load() {
  return store.refreshList()
}

return {store,toast,confirmation,listQuery,search,statusFilter,pageSize,page,items,total,draft,busy,saveError,dirty,pending,error,warning,locale,writable,publishable,statusLabel,filtered,sortRows,notify,edit,close,changeState,canMove,movePosition,load,ready}
}
