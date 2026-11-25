// 角色详情保存、目录刷新和未保存保护的页面编排；授权规则和业务请求归 roles store。
import {useAdminRolesStore} from '~/stores/admin/roles'
import {storeToRefs} from 'pinia'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminDetailLabel} from '~/composables/admin/navigation/useAdminDetailLabel'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'

export function useRoleDetailsManagement(){
const route = useRoute(), store = useAdminRolesStore()
const {
  editor,
  nameError,
  metadataDirty,
  withinScope,
  editable
} = storeToRefs(store)
const {role, form, submitError, warning, catalogError, feedback} = toRefs(editor.value)
const canEdit = store.canEdit
const loadError = computed(() => editor.value.error)
const pending = computed(() => editor.value.pending)
const busy = useAdminBusy(() => store.editor.busy)
const toast = feedback
const confirmation = useAdminActionConfirm()
const nameTouched = computed({
  get: () => editor.value.nameTouched,
  set: value => { editor.value.nameTouched = value }
})
const backTo = computed(() =>
  typeof route.query.returnTo === 'string' && route.query.returnTo.startsWith('/admin/roles?')
    ? route.query.returnTo
    : '/admin/roles'
)
const unsaved = useAdminUnsavedGuard(
  () => store.editorDirty,
  '放弃未保存的角色修改？',
  true,
  () => confirmation.ask({
    title: '放弃未保存的角色修改？',
    message: '未保存的资料、权限或菜单修改将丢失；已保存内容不受影响。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)

const ready=callOnce(
  `admin-role-editor:${store.list.data ? 'list' : 'direct'}:${String(route.params.id)}:${route.fullPath}`,
  () => store.enterEditor(String(route.params.id)),
  {mode: 'navigation'}
)
useAdminDetailLabel(() => editable.value ? '编辑角色' : '查看角色')
onBeforeRouteUpdate(() => unsaved.guard())
watch(
  () => String(route.params.id),
  id => {
    if (id !== editor.value.id)
      store.enterEditor(id)
  }
)
onMounted(async () => {
  if (route.query.created !== '1' || !role.value)
    return
  editor.value.feedback = {
    message: '角色已创建，请按需分配页面和操作权限。',
    status: 'success'
  }
  const query = {...route.query}
  delete query.created
  await navigateTo({path: route.path, query}, {replace: true})
})
useAdminRefresh(
  () => store.refreshEditor(),
  () => unsaved.guard()
)
onBeforeUnmount(() => store.leaveEditor())

async function refreshCatalog() {
  await store.refreshCatalog()
}

async function saveMetadata() {
  if (role.value?.enabled && !form.value.enabled && !await confirmation.ask({
    title: '禁用角色',
    message: '禁用后，该角色不再向关联账号提供权限和导航。确定禁用？',
    confirmLabel: '禁用角色'
  }))
    return
  await store.saveMetadata()
}

return {store,editor,nameError,metadataDirty,withinScope,editable,role,form,submitError,warning,catalogError,feedback,canEdit,loadError,pending,busy,toast,confirmation,nameTouched,backTo,refreshCatalog,saveMetadata,ready}
}
