// 媒体库页面交互：查询同步、选择、预览和删除确认；上传删除队列及请求仍归 media store。
import {useAdminPreferencesStore} from '~/stores/admin/preferences'
import {useAdminListQuery} from '~/composables/admin/list/useAdminListQuery'
import { useAdminMediaStore } from '~/stores/admin/media';
import { useAdminSessionStore } from '~/stores/admin/session';
import { useAdminUnsavedGuard } from '~/composables/admin/forms/useAdminUnsavedGuard';
import { useAdminBusy, useAdminRefresh } from '~/composables/admin/navigation/useAdminRefresh';
import { useAdminActionConfirm } from '~/composables/admin/interaction/useAdminActionConfirm';
import type { MediaRecord } from '#shared/types/admin/media';
export function useMediaLibraryManagement(){
const store = useAdminMediaStore(), session = useAdminSessionStore(), confirmation = useAdminActionConfirm();
const busy = useAdminBusy(() => store.busy);
const unsaved = useAdminUnsavedGuard(() => store.dirty, '离开将放弃未保存的媒体资料。');
const preferences = useAdminPreferencesStore();
const actorId = session.session?.user?.id ?? 'anonymous';
const list = useAdminListQuery({path:'/admin/media',filterKey:'kind',filterValues:['image','video'],defaultPageSize:preferences.pageSize(actorId)});
const preview = ref<MediaRecord | null>(null);
const mediaRowKeys = new Map<string, string>();
const mediaRows = computed(() => {
    const uploadedIds = new Set(store.uploads.flatMap(item => item.record ? [item.record.id] : []));
    const uploading = store.uploads.map(upload => {
        const key = 'upload-' + upload.id;
        if (upload.record) mediaRowKeys.set(upload.record.id, key);
        return {key, record: upload.record, upload};
    });
    return [...uploading, ...store.result.items.filter(item => !uploadedIds.has(item.id)).map(record => ({key: mediaRowKeys.get(record.id) ?? record.id, record, upload: undefined}))];
});
const deletionById = computed(() => new Map(store.deletions.map(item => [item.id, item])));
const selected = ref<string[]>([]);
const deleting = ref(false);
const selectable = computed(() => store.result.items.filter(item => !item.references.length));
const allSelected = computed(() => selectable.value.length > 0 && selectable.value.every(item => selected.value.includes(item.id)));
function toggleAll(event: Event) { selected.value = (event.target as HTMLInputElement).checked ? selectable.value.map(item => item.id) : []; }
watch(() => store.result, () => { selected.value = []; });
const sync = () => store.load({...list.apiQuery.value, pageSize: list.apiQuery.value.pageSize});
watch(list.apiQuery, () => { selected.value = []; void sync(); });
const ready=sync();
useAdminRefresh(async () => { store.close(); await sync(); if (store.loadError)
    throw new Error(store.loadError); }, () => unsaved.guard());
onBeforeUnmount(store.leave);
async function upload(event: Event) { const input = event.target as HTMLInputElement; const files = Array.from(input.files ?? []); if (files.length && await unsaved.guard())
    await store.uploadFiles(files); input.value = ''; }
async function edit(row: MediaRecord) { if (await unsaved.guard())
    store.edit(row); }
async function close() { if (await unsaved.guard())
    store.close(); }
async function refreshAfterDelete(work: () => Promise<void>) {
    deleting.value = true;
    try {
        await work();
        const lastPage = Math.max(1, Math.ceil(store.result.total / store.result.pageSize));
        if (!store.loadError && !store.result.items.length && list.page.value > lastPage) {
            await list.goToPage(lastPage);
        }
    } finally {
        deleting.value = false;
    }
}
async function remove(row: MediaRecord) {
    if (store.pending || deleting.value) return;
    if (await confirmation.ask({ title: '删除媒体？', message: '将永久删除原文件和媒体记录，无法撤销。被引用的素材不能删除。', confirmLabel: '删除' }))
        await refreshAfterDelete(() => store.remove(row));
}
async function removeSelected() {
    if (busy.value || store.pending || deleting.value || !session.can('content.media.delete')) return;
    const rows = store.result.items.filter(item => !item.references.length && selected.value.includes(item.id));
    if (!rows.length || !await unsaved.guard()) return;
    if (!await confirmation.ask({title: '删除所选 ' + rows.length + ' 项媒体？', message: '将永久删除所选原文件和媒体记录，无法撤销。被引用的素材不能删除。', confirmLabel: '删除 ' + rows.length + ' 项'})) return;
    store.close();
    selected.value = [];
    await refreshAfterDelete(() => store.removeMany(rows));
}

return {store,session,confirmation,busy,list,preview,mediaRows,deletionById,selected,deleting,selectable,allSelected,toggleAll,sync,upload,edit,close,remove,removeSelected,ready}
}
