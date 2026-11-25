// 菜单管理页面接线：筛选、编辑、危险操作确认及生命周期；树规则和持久化由既有 store、utils 管理。
import {filterMenuTree} from '~/utils/admin/menus/filter'
import {useAdminMenusStore} from '~/stores/admin/menus'
import {storeToRefs} from 'pinia'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import type {MenuRecord} from '#shared/types/admin/menus'

export function useMenuManagement(){
const auth = useAdminSessionStore(), store = useAdminMenusStore(), route = useRoute()
const {
  menus,
  pages,
  pending,
  loadError,
  catalogError,
  warning,
  feedback,
  collapsed
} = storeToRefs(store)
const busy = useAdminBusy(() => store.busy)
const toast = feedback
const confirmation = useAdminActionConfirm()
const listQuery = useAdminListQuery({
  path: '/admin/menus',
  filterKey: 'visibility',
  filterValues: ['visible', 'hidden'],
  defaultPageSize: 20,
  paginated: false
})
const search = toRef(listQuery.draft, 'search'), visibility = toRef(listQuery.draft, 'filter')
const unsaved = useAdminUnsavedGuard(
  () => store.dirty,
  '放弃未保存的菜单修改？',
  () => store.editor.open,
  () => confirmation.ask({
    title: '放弃菜单修改？',
    message: '未保存的菜单内容将丢失，已保存的导航不受影响。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)
const displayed = computed(() => filterMenuTree(menus.value ?? [], listQuery.applied.value.search, listQuery.applied.value.filter, collapsed.value, row => row.name + ' ' + row.code))

const ready=callOnce(
  `admin-menus:${store.menus ? 'loaded' : 'first'}:${route.fullPath}`,
  () => store.enter(),
  {mode: 'navigation'}
)
onBeforeUnmount(() => store.leave())
useAdminRefresh(
  async () => {
    await store.refresh()
    store.closeEditor()
  },
  () => unsaved.guard()
)

const branchExpanded = (id: string) =>
  store.branchExpanded(id, listQuery.applied.value.search, listQuery.applied.value.filter)
const {toggleBranch, depth, neighbor} = store

const creatingWebsite = ref(false)
function openEditor(row: MenuRecord | null) {
  creatingWebsite.value = false
  store.edit(row)
}
function createWebsite() {
  creatingWebsite.value = true
  store.edit(null,true)
}

async function closeEditor() {
  if (!busy.value && await unsaved.guard())
    store.closeEditor()
}

async function quickUpdate(row: MenuRecord, visible: boolean) {
  if (busy.value || !auth.can('system.menus.update'))
    return
  if (!visible && !await confirmation.ask({
    title: '隐藏菜单',
    message: '隐藏“' + row.name + '”及其下导航入口？已有操作权限不受影响。',
    confirmLabel: '隐藏菜单'
  }))
    return
  await store.updateVisibility(row, visible)
}

async function move(row: MenuRecord, direction: 'up' | 'down') {
  if (!store.neighbor(row, direction) || !auth.can('system.menus.update'))
    return
  await store.move(row, direction)
}

async function remove(row: MenuRecord) {
  if (row.deleteDisabledReason || !auth.can('system.menus.delete') || !await confirmation.ask({
    title: '删除菜单',
    message: `确定删除菜单“${row.name}”？有子菜单或角色引用时不能删除。绑定官网页面的菜单只能在页面维护中永久删除。`,
    confirmLabel: '删除菜单'
  }))
    return
  await store.remove(row)
}

async function saveEditor() {
  if (store.editor.editing?.visible && !store.editor.form.visible && !await confirmation.ask({
    title: '隐藏菜单',
    message: '隐藏“' + store.editor.form.name + '”及其下导航入口？已有操作权限不受影响。',
    confirmLabel: '隐藏菜单'
  }))
    return
  const {code,pageKey}=store.editor.form
  const result=await store.saveEditor()
  if(result.succeeded&&creatingWebsite.value&&pageKey==='website_page'&&auth.isRoot)await navigateTo('/admin/website/'+code)
}

return {auth,store,menus,pages,pending,loadError,catalogError,warning,feedback,busy,toast,confirmation,listQuery,search,visibility,displayed,branchExpanded,toggleBranch,depth,neighbor,openEditor,createWebsite,closeEditor,quickUpdate,move,remove,saveEditor,ready}
}
