// 角色列表查询、创建与删除确认的页面编排；授权规则和业务请求归 roles store。
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminRolesStore} from '~/stores/admin/roles'
import {storeToRefs} from 'pinia'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import type {RoleListRecord} from '#shared/types/admin/roles'

export function useRolesListManagement(){
const auth = useAdminSessionStore(), preferences = useAdminPreferencesStore()
const actorId = auth.session?.user?.id ?? 'anonymous'
const pageRoute = useRoute()
const route = useRoute(), store = useAdminRolesStore()
const listQuery = useAdminListQuery({
  path: '/admin/roles',
  filterKey: 'status',
  filterValues: ['enabled', 'disabled'],
  defaultPageSize: preferences.pageSize(actorId)
})
const {search, filter: status, pageSize} = toRefs(listQuery.draft)
const page = listQuery.page
const {list, listFieldErrors} = storeToRefs(store)
const {form, touched, createdRole, warning, createError} = toRefs(list.value)
const data = computed(() => list.value.data)
const pending = computed(() => list.value.pending)
const loadError = computed(() => list.value.error)
const error = createError
const busy = useAdminBusy(() => store.list.busy)
const toast = computed(() => list.value.feedback)
const fieldErrors = listFieldErrors
const confirmation = useAdminActionConfirm()
const open = ref(false)
const unsaved = useAdminUnsavedGuard(
  () => open.value && store.listDirty,
  '放弃未保存的角色信息？',
  () => open.value,
  () => confirmation.ask({
    title: '放弃新增角色？',
    message: '本次填写的角色信息尚未保存，放弃后将清空。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)

const ready=callOnce(
  `admin-roles-list:${auth.generation}:${pageRoute.fullPath}`,
  () => store.enterList(listQuery.apiQuery.value),
  {mode: 'navigation'}
)
watch(() => listQuery.apiQuery.value, query => store.enterList(query), {deep: true})
onBeforeUnmount(() => store.leaveList())
useAdminRefresh(
  () => store.refreshList(),
  () => unsaved.guard()
)

function openCreate() {
  store.resetListForm()
  open.value = true
}

async function close() {
  if (!busy.value && await unsaved.guard()) {
    open.value = false
    store.resetListForm()
    list.value.warning = ''
  }
}

async function create() {
  const created = await store.createRole()
  if (!created)
    return
  open.value = false
  try {
    await navigateTo({
      path: '/admin/roles/' + created.id,
      query: {returnTo: route.fullPath, created: '1'}
    })
  } catch {
    list.value.warning = '角色已创建，但详情跳转失败。请继续查看角色，勿重复创建。'
  }
}

async function remove(row: RoleListRecord) {
  if (!await confirmation.ask({
    title: '删除角色',
    confirmLabel: '删除角色',
    message: `确定删除角色“${row.name}”？此操作无法撤销。`
  }))
    return
  const outcome = await store.removeRole(row)
  if (outcome.fallbackPage)
    await listQuery.goToPage(outcome.fallbackPage)
}

async function retryList() {
  try {
    await store.refreshList()
  } catch {
    // store 保留具体错误。
  }
}

return {auth,route,store,listQuery,search,status,pageSize,page,list,form,touched,createdRole,warning,data,pending,loadError,error,busy,toast,fieldErrors,confirmation,open,openCreate,close,create,remove,retryList,ready}
}
