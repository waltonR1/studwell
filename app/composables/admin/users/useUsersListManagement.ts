// 账号列表交互编排：查询、创建与危险操作确认；密码仅留在当前组件作用域并在身份切换和卸载时清空。
import {adminRequestMessage} from '~/utils/admin/request/errors'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'
import {useAdminUsersStore} from '~/stores/admin/users'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {storeToRefs} from 'pinia'
import type {UserListRecord} from '#shared/types/admin/users'

export function useUsersListManagement(){
const auth = useAdminSessionStore()
const preferenceState = useAdminPreferencesStore()
const actorId = auth.session?.user?.id ?? 'anonymous'
const pageRoute = useRoute()

const {session} = storeToRefs(auth)
const route = pageRoute
const store = useAdminUsersStore()
const listQuery = useAdminListQuery({
  path: '/admin/users',
  filterKey: 'status',
  filterValues: ['enabled', 'disabled'],
  defaultPageSize: preferenceState.pageSize(actorId)
})
const {search, filter: status, pageSize} = toRefs(listQuery.draft)
const page = listQuery.page
const {
  list,
  profileCatalog,
  profileCatalogError,
  profileCatalogPending,
  create,
  createFieldErrors
} = storeToRefs(store)
const {canEditRow, canToggle} = store
const {form, touched, error} = toRefs(create.value)
const data = computed(() => list.value.data)
const loadError = computed(() => list.value.error)
const pending = computed(() => list.value.pending)
const busy = useAdminBusy(() => store.busy)
const toggling = computed(() => list.value.togglingId)
const warning = computed(() => create.value.warning || list.value.warning)
const toast = computed(() => list.value.feedback)
const actionConfirm = useAdminActionConfirm()
let alive=true
const createOpen = ref(false)
const createPassword = ref('')
const passwordTouched = ref(false)
const fieldErrors = createFieldErrors
const createUnsaved = useAdminUnsavedGuard(
  () => createOpen.value && (store.createDirty || !!createPassword.value),
  '放弃未保存的账号信息？',
  () => createOpen.value,
  () => actionConfirm.ask({
    title: '放弃新增账号？',
    message: '已填写的账号信息尚未保存。放弃后将清空本次填写的内容。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)

const ready=callOnce(
  `admin-users-list:${store.identityVersion}:${route.fullPath}`,
  () => store.enterList(listQuery.apiQuery.value),
  {mode: 'navigation'}
)
watch(
  () => listQuery.apiQuery.value,
  query => store.enterList(query),
  {deep: true}
)
onBeforeUnmount(() => {alive=false;store.leaveList();createPassword.value='';passwordTouched.value=false})
watch(()=>auth.generation,()=>{createPassword.value='';passwordTouched.value=false;createOpen.value=false},{flush:'sync'})
useAdminRefresh(
  () => store.refreshList(),
  () => createUnsaved.guard()
)

async function clearCreate() {
  store.resetCreate()
  createPassword.value = ''
  passwordTouched.value = false
  createOpen.value = true
}

async function closeCreate() {
  if (!busy.value && await createUnsaved.guard()) {
    createOpen.value = false
    store.resetCreate()
    createPassword.value = ''
    passwordTouched.value = false
  }
}

async function submitCreate() {
  const generation=auth.generation
  const outcome = await store.createAccount(createPassword.value)
  if(!alive||generation!==auth.generation)return
  passwordTouched.value = true
  if (!outcome.submitted)
    return
  createPassword.value = ''
  passwordTouched.value = false
  if (!outcome.succeeded)
    return
  createOpen.value = false
  if (!outcome.created)
    return
  if (!auth.can('system.users.read')) {
    list.value.feedback = {
      message: '账号已创建，尚未分配角色，请联系有权限的管理员完成授权。',
      status: 'success'
    }
    return
  }
  try {
    await navigateTo({
      path: `/admin/users/${outcome.created.id}`,
      query: {returnTo: route.fullPath, created: '1'}
    })
  } catch (navigationError) {
    create.value.warning = `账号已创建，但详情跳转失败：${adminRequestMessage(navigationError)}。请使用下方入口继续，勿重复创建。`
  }
}

async function retryList() {
  try {
    await store.refreshList()
  } catch {
    // 列表状态保留具体失败原因，按钮只负责重试。
  }
}

async function toggleEnabled(row: UserListRecord) {
  if (row.enabled && !await actionConfirm.ask({
    title: '禁用账号',
    message: `确定禁用账号“${row.username}”？禁用后将无法登录，已登录的用户会立即退出。账号资料和角色分配会保留，可随时重新启用；重新启用后需重新登录。`,
    confirmLabel: '禁用账号'
  }))
    return
  const outcome = await store.toggleEnabled(row)
  if (outcome.fallbackPage)
    await listQuery.goToPage(outcome.fallbackPage)
}

async function remove(row: UserListRecord) {
  if (!await actionConfirm.ask({
    title: '删除账号',
    message: `确定删除账号“${row.username}”？删除后将无法登录，已登录的用户会立即退出，账号将从列表移除。历史操作记录会保留，用户名可用于创建新账号；新账号不会继承原账号的角色或记录。当前不支持恢复；如仅需暂停使用，请选择禁用。`,
    confirmLabel: '删除账号'
  }))
    return
  const outcome = await store.remove(row)
  if (outcome.fallbackPage)
    await listQuery.goToPage(outcome.fallbackPage)
}


return {auth,session,route,store,listQuery,search,status,pageSize,page,list,profileCatalog,profileCatalogError,profileCatalogPending,create,canEditRow,canToggle,form,touched,error,data,loadError,pending,busy,toggling,warning,toast,actionConfirm,createOpen,createPassword,passwordTouched,fieldErrors,clearCreate,closeCreate,submitCreate,retryList,toggleEnabled,remove,ready}
}
