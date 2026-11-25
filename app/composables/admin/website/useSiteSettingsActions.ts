import {ref} from 'vue'
import {storeToRefs} from 'pinia'
import {useAdminSiteSettingsStore} from '~/stores/admin/site-settings'
import type {SiteLocale, SiteSection} from '#shared/schemas/admin/site-settings'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'

// 只协调页面交互，不保存第二份业务草稿或提交状态。
export function useSiteSettingsActions(options: {
  section: () => SiteSection
  title: () => string
  locale: () => SiteLocale
}) {
  const store = useAdminSiteSettingsStore()
  const {record, dirty, editorDirty, publishing, canPublish, canEdit, busy} = storeToRefs(store)
  const toast = useAdminToast(), confirmation = useAdminActionConfirm()
  const historyOpen = ref(false)

  async function save(section: SiteSection) {
    toast.dismiss();
    const result = await store.save(section);
    if (result) toast.show(result.message, result.status)
  }

  async function publish(releaseId?: string) {
    const publication = record.value?.publication?.[options.section()]
    if (!publication || (!releaseId && (dirty.value || editorDirty.value)) || publishing.value || !canPublish.value) return
    if (!await confirmation.ask({
      title: releaseId ? '回滚发布版本？' : '发布当前模块？',
      message: releaseId ? '只回滚' + options.title() + '的发布版本，当前草稿及其他模块不变。' : '只发布' + options.title() + '已保存的全部语言内容，其他模块不变。',
      confirmLabel: releaseId ? '确认回滚' : '确认发布',
      cancelLabel: '取消'
    })) return
    toast.dismiss()
    const result = await store.publish(options.section(), releaseId)
    if (result) {
      toast.show(result.message, result.status);
      if (result.status === 'success') historyOpen.value = false
    }
  }

  async function closeEditor() {
    if (editorDirty.value && !await confirmation.ask({
      title: '放弃本次修改？',
      message: '此窗口中的修改尚未确认。',
      confirmLabel: '放弃修改',
      cancelLabel: '继续编辑'
    })) return
    store.closeEditor()
  }

  const confirmLink = () => store.confirmNavigation(options.locale())

  async function remove(list: unknown[], index: number) {
    if (!canEdit.value || busy.value) return
    if (await confirmation.ask({
      title: '移除此项？',
      message: '移除后需保存当前分区。',
      confirmLabel: '移除',
      cancelLabel: '取消'
    })) {
      toast.dismiss()
      store.removeNavigation(list, index)
    }
  }

  return {toast, confirmation, historyOpen, save, publish, closeEditor, confirmLink, remove}
}
