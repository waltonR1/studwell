// 参数管理页面交互：加载刷新、保存确认和未保存保护；规则计算与草稿仍由 parameters store 管理。
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminParametersStore} from '~/stores/admin/parameters'
import {storeToRefs} from 'pinia'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import type {ParameterGroup} from '#shared/types/admin/parameters'

export function useParameterManagement(){
const auth = useAdminSessionStore(), preferences = useAdminPreferencesStore()
const actorId = auth.session?.user?.id ?? 'anonymous'
const pageRoute = useRoute()
const store = useAdminParametersStore()
const {
  pending,
  loadError,
  warning,
  feedback,
  search,
  category,
  page,
  pageSize,
  rows,
  filteredRows,
  pageRows
} = storeToRefs(store)
const toast = feedback
const busy = useAdminBusy(() => store.busy)
const confirmation = useAdminActionConfirm()
const unsaved = useAdminUnsavedGuard(
  () => store.open && store.dirty,
  '放弃未保存的参数修改？',
  () => store.open,
  () => confirmation.ask({
    title: '放弃参数修改？',
    message: '未保存的参数不会生效，放弃后将重新读取最新设置。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)

const ready=callOnce(
  `admin-parameters:${auth.generation}:${pageRoute.fullPath}`,
  () => store.load(false, preferences.pageSize(actorId)),
  {mode: 'navigation'}
)
useAdminRefresh(
  () => store.discardAndReload(preferences.pageSize(actorId)),
  () => unsaved.guard()
)
onBeforeUnmount(() => store.leave())

async function closeEditor() {
  if (await unsaved.guard())
    store.close()
}

async function save(group: ParameterGroup, reset = false) {
  if (reset && !await confirmation.ask({
    title: '恢复默认值？',
    message: '当前参数将恢复为默认值，按说明生效。',
    confirmLabel: '恢复默认'
  }))
    return
  await store.save(group, reset)
}

async function reload() {
  if (!await unsaved.guard())
    return
  try {
    await store.reload(preferences.pageSize(actorId))
  } catch {
    // store 保留具体加载错误。
  }
}

function resetPage() {
  page.value = 1
}
const {applySearch, groupName, displayValue, edit, canEdit} = store

return {store,pending,loadError,warning,feedback,search,category,page,pageSize,rows,filteredRows,pageRows,toast,busy,confirmation,closeEditor,save,reload,resetPage,applySearch,groupName,displayValue,edit,canEdit,ready}
}
