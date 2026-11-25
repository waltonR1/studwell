// 字典选项切换、保存确认和取消的界面编排；共享版本、草稿和请求由 dictionaries store 管理。
import {storeToRefs} from 'pinia'
import {useAdminDictionariesStore} from '~/stores/admin/dictionaries'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import type {DictionaryItem} from '#shared/types/admin/dictionaries'

export function useDictionaryItemsManagement(onSaved:(id:string)=>void){
const store = useAdminDictionariesStore(), confirmation = useAdminActionConfirm()
const {
  editor,
  canCreateItem,
  canUpdateItem,
  filteredItems,
  itemPages,
  pagedItems,
  writableItem,
  itemDirty,
  itemErrors
} = storeToRefs(store)
const {
  busy,
  detail,
  itemSearch,
  itemStatus,
  itemPage,
  itemPageSize,
  itemEditorOpen,
  editingItem,
  itemError,
  itemForm,
  itemTouched
} = toRefs(editor.value)

async function startItem(row: DictionaryItem | null) {
  const currentId = editingItem.value?.id
  const nextId = row?.id
  if (
    itemEditorOpen.value
    && (currentId ?? 'new') !== (nextId ?? 'new')
    && itemDirty.value
    && !await confirmation.ask({
      title: '放弃选项修改？',
      message: '当前选项仍有未保存修改，切换后将丢失。',
      cancelLabel: '继续编辑',
      confirmLabel: '放弃修改'
    })
  )
    return
  store.startItem(row)
}

async function closeItemEditor() {
  if (
    !busy.value
    && (
      !itemDirty.value
      || await confirmation.ask({
        title: '放弃选项修改？',
        message: '尚未保存的选项内容将丢失。',
        cancelLabel: '继续编辑',
        confirmLabel: '放弃修改'
      })
    )
  )
    store.closeItemEditor()
}

async function saveItem() {
  if (
    editingItem.value?.enabled
    && editor.value.itemForm.enabled === false
    && !await confirmation.ask({
      title: '停用字典选项',
      message: '停用后该选项不能再用于新增选择，已有记录仍可按 ID 解析当前名称和停用状态。',
      confirmLabel: '停用选项'
    })
  )
    return
  const result = await store.saveItem()
  if (result.succeeded && result.id)
    onSaved(result.id)
}

return {confirmation,editor,canCreateItem,canUpdateItem,filteredItems,itemPages,pagedItems,writableItem,itemDirty,itemErrors,busy,detail,itemSearch,itemStatus,itemPage,itemPageSize,itemEditorOpen,editingItem,itemError,itemForm,itemTouched,startItem,closeItemEditor,saveItem}
}
