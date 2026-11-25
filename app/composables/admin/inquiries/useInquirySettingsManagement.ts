// 咨询设置交互：加载、保存、分类编辑确认和通知；原始草稿由 inquiry-settings store 管理。
import {previewValues} from '~/config/admin/inquiry-settings'
import {adminContentLocale} from '#shared/config/site-languages'
import {storeToRefs} from 'pinia'
import type {SiteLocale} from '#shared/schemas/admin/site-settings'
import {forwardBodyTokens} from '#shared/config/admin/inquiry-forward-template'
import {renderForwardTemplate} from '#shared/utils/admin/inquiry-forward-template'
import {useAdminInquirySettingsStore} from '~/stores/admin/inquiry-settings'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'
import {useAdminUnsavedGuard} from '~/composables/admin/forms/useAdminUnsavedGuard'
import {useAdminBusy, useAdminRefresh} from '~/composables/admin/navigation/useAdminRefresh'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'

export function useInquirySettingsManagement(props:{readonly mode:'categories'|'mail'}){
const isCategories = computed(() => props.mode === 'categories')
const title = computed(() => isCategories.value ? '咨询类型' : '邮件设置')
const locale = ref<SiteLocale>(adminContentLocale)
const store = useAdminInquirySettingsStore()
const {draft, pending, loadError, error, selected, editing, dirty, editorDirty, editorError, codeLocked, forwardMode, editingTemplate, identity, canRead} = storeToRefs(store)
const {load, addCategory, editCategory, applyCategory, setEnabled, move, save: persistSettings} = store
const busy = useAdminBusy(() => store.busy)
onBeforeRouteLeave(() => !busy.value)
const confirmation = useAdminActionConfirm()
const unsaved = useAdminUnsavedGuard(() => dirty.value || editorDirty.value, '放弃未保存的咨询设置？')
const toast = useAdminToast()
const categorySearch = ref(''), categoryStatus = ref(''), appliedCategorySearch = ref(''), appliedCategoryStatus = ref('')
const categoryRows = computed(() => (draft.value?.settings.categories ?? []).map((item, index) => ({
  id:String(index), index, name:item.labels[locale.value] || '未填写', code:item.code, visible:item.enabled,
})))
const displayedCategoryRows = computed(() => categoryRows.value.filter(item =>
  (!appliedCategorySearch.value || (item.name + ' ' + item.code).toLowerCase().includes(appliedCategorySearch.value.toLowerCase()))
  && (!appliedCategoryStatus.value || item.visible === (appliedCategoryStatus.value === 'visible'))))
const preview = computed(() => editingTemplate.value ? {
  subject:renderForwardTemplate(editingTemplate.value.subject, {id:previewValues.id,category:previewValues.category}),
  body:renderForwardTemplate(editingTemplate.value.body, Object.fromEntries(forwardBodyTokens[forwardMode.value].map(key => [key, previewValues[key]]))),
} : null)
const tokenText = (key: string) => '{{' + key + '}}'
const assigneeOptions = computed(() => {
  const options = [{value:'',label:'手动认领'}, ...(draft.value?.assignees ?? []).map(user => ({value:user.id,label:user.name}))]
  const current = editing.value?.defaultAssigneeId
  if (current && !options.some(option => option.value === current)) options.push({value:current,label:'当前负责人已不可用'})
  return options
})

function enter() { if (canRead.value) void load() }
onMounted(enter)
watch([identity, canRead], () => {
  toast.dismiss()
  enter()
})
onBeforeUnmount(() => {
  store.leave()
  toast.dismiss()
})
useAdminRefresh(async () => {
  if (await load()) store.closeEditor()
}, unsaved.guard)

function queryCategories() {
  appliedCategorySearch.value = categorySearch.value.trim()
  appliedCategoryStatus.value = categoryStatus.value
}

async function save() {
  const notification = await persistSettings()
  if (notification) toast.show(notification.message, notification.status)
}

async function closeEditor() {
  if (!editorDirty.value || await confirmation.ask({title:'放弃类型修改？', message:'弹窗中的更改尚未应用到设置。', confirmLabel:'放弃修改', cancelLabel:'继续编辑'}))
    store.closeEditor()
}
async function remove(index: number) {
  const row = categoryRows.value[index]
  if (row && await confirmation.ask({title:'删除咨询类型？', message:'保存设置后将删除“' + row.name + '”。有历史咨询引用的类型应停用。', confirmLabel:'删除'}))
    store.remove(index)
}
async function restoreForwardTemplate() {
  if (await confirmation.ask({title:'恢复默认转发文案？', message:'将替换当前模板的草稿，保存设置后生效。', confirmLabel:'恢复默认'}))
    store.restoreForwardTemplate()
}

return {isCategories,title,locale,draft,pending,loadError,error,selected,editing,dirty,editorError,codeLocked,forwardMode,editingTemplate,load,addCategory,editCategory,applyCategory,setEnabled,move,busy,confirmation,toast,categorySearch,categoryStatus,appliedCategorySearch,appliedCategoryStatus,categoryRows,displayedCategoryRows,preview,tokenText,assigneeOptions,queryCategories,save,closeEditor,remove,restoreForwardTemplate}
}
