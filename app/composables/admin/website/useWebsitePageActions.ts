import {ref} from 'vue'
import {storeToRefs} from 'pinia'
import {useAdminWebsitePagesStore} from '~/stores/admin/website-pages'
import {useAdminToast} from '~/composables/admin/interaction/useAdminToast'
import {useAdminActionConfirm} from '~/composables/admin/interaction/useAdminActionConfirm'

// 页面作用域的确认、通知和操作窗口；草稿、请求及业务校验仍由 Store 持有。
export function useWebsitePageActions() {
  const store = useAdminWebsitePagesStore()
  const {record, busy, dirty, canDelete} = storeToRefs(store)
  const toast = useAdminToast(), confirm = useAdminActionConfirm()
  const historyOpen = ref(false), deleteOpen = ref(false), removedName = ref('')

  async function closeAssemblyEditor() {
    if (store.assemblyEditorDirty && !await confirm.ask({title:'放弃本次修改？',message:'此窗口中的修改尚未确认。',confirmLabel:'放弃修改',cancelLabel:'继续编辑'})) return
    store.closeAssemblyEditor()
  }

  async function save() {
    toast.dismiss();
    const result = await store.save();
    if (result) toast.show(result.message, result.status)
  }

  async function publish(releaseId?: string) {
    if (!await confirm.ask({
      title: releaseId ? '回滚本页？' : '发布本页？',
      message: releaseId ? '只切换本页发布版本；已保存草稿和未保存输入均保留。下一次发布将发布工作草稿。' : '发布本页全部语言的已保存内容，其他页面不受影响。',
      confirmLabel: releaseId ? '确认回滚' : '确认发布',
      cancelLabel: '取消'
    })) return;
    toast.dismiss();
    const result = await store.publish(releaseId);
    if (result) {
      toast.show(result.message, result.status);
      if (result.status === 'success') historyOpen.value = false
    }
  }

  async function withdraw() {
    if (await confirm.ask({
      title: '下线页面？',
      message: '下线后停止提供当前发布版本，工作草稿和发布历史保留。若有公开路由，请先停用并发布；其他已发布内容的引用也需先调整并发布。',
      confirmLabel: '确认下线',
      cancelLabel: '取消'
    })) {
      toast.dismiss();
      const result = await store.withdraw();
      if (result) toast.show(result.message, result.status)
    }
  }

  function openDeletion() {
    if (busy.value || dirty.value || store.assemblyEditorDirty || !canDelete.value || record.value?.publication.publishedReleaseId) return;
    store.clearDeletionError();
    deleteOpen.value = true
  }

  async function permanentlyRemove(code: string) {
    toast.dismiss();
    const name = record.value?.name ?? '';
    const result = await store.permanentlyRemove(code);
    if (result) {
      if (result.status === 'success') {
        removedName.value = name;
        deleteOpen.value = false;
        historyOpen.value = false
      }
      toast.show(result.message, result.status)
    }
  }

  async function remove(id: string) {
    if (await confirm.ask({
      title: '移除区块？',
      message: '保存页面设置后将删除此实例工作草稿，历史记录保留。',
      confirmLabel: '移除',
      cancelLabel: '取消'
    })) {
      toast.dismiss();
      store.remove(id)
    }
  }

  return {toast, confirm, historyOpen, deleteOpen, removedName, save, publish, withdraw,
    openDeletion, permanentlyRemove, remove, closeAssemblyEditor}
}
