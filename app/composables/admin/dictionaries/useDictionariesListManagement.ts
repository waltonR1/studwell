// 字典列表查询和生命周期的界面编排；共享版本、草稿和请求由 dictionaries store 管理。
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminDictionariesStore} from '~/stores/admin/dictionaries'
import {storeToRefs} from 'pinia'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'

export function useDictionariesListManagement(){
const auth = useAdminSessionStore(), preferences = useAdminPreferencesStore()
const actorId = auth.session?.user?.id ?? 'anonymous'
const pageRoute = useRoute()
const store = useAdminDictionariesStore()
const {list} = storeToRefs(store)
const listQuery = useAdminListQuery({
  path: '/admin/dictionaries',
  filterKey: 'status',
  filterValues: ['enabled', 'disabled'],
  defaultPageSize: preferences.pageSize(actorId)
})
const {search, filter: status, pageSize} = toRefs(listQuery.draft)
const page = listQuery.page
const data = computed(() => list.value.data)
const pending = computed(() => list.value.pending)
const loadError = computed(() => list.value.error)
const busy = useAdminBusy(() => store.editor.busy)
const canEdit = store.canEditAny
const openDialog = store.openDictionary

const ready=callOnce(
  `admin-dictionaries:${auth.generation}:${pageRoute.fullPath}`,
  () => store.enterList(listQuery.apiQuery.value),
  {mode: 'navigation'}
)
watch(() => listQuery.apiQuery.value, query => store.enterList(query), {deep: true})
onBeforeUnmount(() => {
  store.leaveList()
  store.closeEditor()
})
useAdminRefresh(() => store.refreshList())

async function refresh() {
  try {
    await store.refreshList()
  } catch {
    // store 保留具体错误。
  }
}

function saved() {
  store.list.stale = true
  refresh()
}

return {auth,list,listQuery,search,status,pageSize,page,data,pending,loadError,busy,canEdit,openDialog,refresh,saved,ready}
}
