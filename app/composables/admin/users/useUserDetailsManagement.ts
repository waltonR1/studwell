// 账号详情交互：分区保存、密码重置确认、目录刷新和生命周期；秘密输入仅在当前作用域保留。
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminDetailLabel} from '~/composables/admin/navigation/useAdminDetailLabel'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminUsersStore} from '~/stores/admin/users'
import type {AdminUserSection} from '~/types/admin/users'
import {storeToRefs} from 'pinia'
import {userResetSchema} from '#shared/schemas/admin/users'

export function useUserDetailsManagement(){
const route = useRoute()
const store = useAdminUsersStore()
const {
  editor,
  profileCatalog,
  profileCatalogError,
  profileCatalogPending,
  canProfile,
  canRoles,
  canReset,
  canEdit,
  pageTitle,
  editorIsSelf,
  profileDirty,
  statusDirty,
  rolesDirty,
  editorFieldErrors,
  roleOptions,
  assignedRoles,
  creationHint
} = storeToRefs(store)
const {user, roles, roleError, rolesPending, form, selected, sectionErrors, touched} = toRefs(editor.value)
const loadError = computed(() => editor.value.error)
const pending = computed(() => editor.value.pending)
const warning = computed(() => editor.value.warning)
const toast = computed(() => editor.value.feedback)
const isSelf = editorIsSelf
const fieldErrors = editorFieldErrors
const busy = useAdminBusy(() => store.busy)
const actionConfirm = useAdminActionConfirm()
const backTo = computed(() =>
  typeof route.query.returnTo === 'string' && route.query.returnTo.startsWith('/admin/users?')
    ? route.query.returnTo
    : '/admin/users',
)
let alive=true
const resetOpen = ref(false)
const password = ref('')
const passwordTouched = ref(false)
watch([()=>store.identityVersion,()=>String(route.params.id)],()=>{password.value='';passwordTouched.value=false;resetOpen.value=false},{flush:'sync'})
const passwordError = computed(() =>
  sectionErrors.value.password
  || (passwordTouched.value && !userResetSchema.safeParse({
    version: user.value?.version ?? 1,
    password: password.value,
  }).success
    ? '密码须为 6–128 个字符。'
    : ''),
)
const unsaved = useAdminUnsavedGuard(
  () => store.editorDirty || (resetOpen.value && !!password.value),
  '放弃未保存的账号修改？',
  true,
  () => actionConfirm.ask({
    title: '放弃未保存的修改？',
    message: '当前账号仍有未保存的修改，离开后这些修改将丢失；已保存的内容不受影响。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)

const ready=callOnce(
  `admin-users-editor:${store.identityVersion}:${route.fullPath}`,
  () => store.enterEditor(String(route.params.id)),
  {mode: 'navigation'}
)
useAdminDetailLabel(() => pageTitle.value)

onBeforeRouteUpdate(() => unsaved.guard())
watch(
  () => String(route.params.id),
  id => {
    if (id !== editor.value.id)
      store.enterEditor(id)
  }
)
onMounted(async () => {
  if (route.query.created !== '1')
    return
  editor.value.feedback = {message: '账号已创建。' + creationHint.value, status: 'success'}
  const query = {...route.query}
  delete query.created
  await navigateTo({path: route.path, query}, {replace: true})
})
useAdminRefresh(
  () => store.refreshEditor(),
  () => unsaved.guard()
)
onBeforeUnmount(() => {
  alive=false
  resetOpen.value=false
  passwordTouched.value=false
  password.value = ''
  store.leaveEditor()
})

async function refreshProfileCatalog() {
  await store.refreshProfileCatalog(true)
}

async function refreshRoleCatalog() {
  await store.refreshRoleCatalog()
}

async function closeReset() {
  if (busy.value)
    return
  if (password.value && !await actionConfirm.ask({
    title: '放弃密码重置？',
    message: '尚未提交的新密码将被清空，账号现有密码不会改变。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  }))
    return
  resetOpen.value = false
  password.value = ''
  passwordTouched.value = false
  store.clearSectionError('password')
}

async function openReset() {
  store.clearSectionError('password')
  password.value = ''
  passwordTouched.value = false
  resetOpen.value = true
}

async function save(kind: AdminUserSection) {
  if (kind === 'status' && !form.value.enabled && !await actionConfirm.ask({
    title: '禁用账号',
    message: `确定禁用账号“${user.value?.username}”？禁用后将无法登录，已登录的用户会立即退出。账号资料和角色分配会保留，可随时重新启用；重新启用后需重新登录。`,
    confirmLabel: '禁用账号'
  }))
    return
  if (kind === 'password' && !await actionConfirm.ask({
    title: '重置账号密码',
    message: `确定重置账号“${user.value?.username}”的密码？全部会话将撤销，下一次登录必须改密。`,
    confirmLabel: '确认重置'
  }))
    return
  const identity=store.identityVersion,id=String(route.params.id)
  const outcome = await store.saveSection(kind, password.value)
  if(!alive||identity!==store.identityVersion||id!==String(route.params.id))return
  if (kind === 'password' && outcome.submitted) {
    password.value = ''
    passwordTouched.value = false
    if (outcome.succeeded)
      resetOpen.value = false
  }
}

return {store,editor,profileCatalog,profileCatalogError,profileCatalogPending,canProfile,canRoles,canReset,canEdit,pageTitle,profileDirty,statusDirty,rolesDirty,roleOptions,assignedRoles,user,roles,roleError,rolesPending,form,selected,sectionErrors,touched,loadError,pending,warning,toast,isSelf,fieldErrors,busy,actionConfirm,backTo,resetOpen,password,passwordTouched,passwordError,refreshProfileCatalog,refreshRoleCatalog,closeReset,openReset,save,ready}
}
