// 字典类型保存确认和弹窗离开保护的界面编排；共享版本、草稿和请求由 dictionaries store 管理。
import {useAdminDictionariesStore} from '~/stores/admin/dictionaries'
import {storeToRefs} from 'pinia'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'

export function useDictionaryDialog(onSaved:(id:string)=>void){
const store = useAdminDictionariesStore(), confirmation = useAdminActionConfirm()
const {
  editor,
  typeEditable,
  dialogTitle,
  typeParsed,
  createMode,
  metadataDirty,
  dirty
} = storeToRefs(store)
const parsed = typeParsed
const {feedback, busy, detail, loading, loadError} = toRefs(editor.value)
const toast = feedback
const unsaved = useAdminUnsavedGuard(
  () => store.editor.open && store.dirty,
  '放弃未保存的字典修改？',
  () => store.editor.open,
  () => confirmation.ask({
    title: '放弃未保存的修改？',
    message: '未保存的字典资料或选项修改将丢失，已保存内容不受影响。',
    cancelLabel: '继续编辑',
    confirmLabel: '放弃修改'
  })
)

useAdminRefresh(
  () => store.refreshEditor(),
  () => unsaved.guard()
)

async function requestClose() {
  if (!busy.value && await unsaved.guard())
    store.closeEditor()
}

async function saveType() {
  if (detail.value?.enabled && !editor.value.typeForm.enabled && !await confirmation.ask({
    title: '停用字典类型',
    message: '停用后业务模块不会再返回新选项，已有记录不会被删除；重新启用不会恢复单独停用的选项。',
    confirmLabel: '停用类型'
  }))
    return
  const result = await store.saveType()
  if (result.succeeded && result.id)
    onSaved(result.id)
}

return {store,confirmation,editor,typeEditable,dialogTitle,createMode,metadataDirty,dirty,parsed,feedback,busy,detail,loading,loadError,toast,requestClose,saveType}
}
