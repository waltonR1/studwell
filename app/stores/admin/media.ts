import type {AdminOperationResult} from '~/types/admin/action-result'
import type {MediaUploadItem} from '~/types/admin/media';
import {getAdminRequestFailure} from '~/utils/admin/request/errors'
import {MEDIA_MAX_BYTES, VIDEO_MAX_BYTES} from '#shared/config/admin/media'
import {computed, ref, watch} from 'vue';
import {defineStore} from 'pinia';
import {createMediaApi} from '~/api/admin/media';
import {useAdminRequestStore} from './request';
import {useAdminSessionStore} from './session';
import type {MediaRecord, MediaList} from '#shared/types/admin/media';
import {mediaUpdateSchema} from '#shared/schemas/admin/media';

export const useAdminMediaStore = defineStore('admin-media', () => {
    const request = useAdminRequestStore(), session = useAdminSessionStore(), api = createMediaApi(request);
    const result = ref<MediaList>({items: [], total: 0, page: 1, pageSize: 20});
    let query: Record<string, string | number | undefined> = {page: 1, pageSize: 20}
    const pending = ref(false), busy = ref(false), error = ref(''), loadError = ref(''), notice = ref('');
    const feedback = ref<AdminOperationResult | null>(null);
    const editor = ref<MediaRecord | null>(null), baseline = ref('');
    const dirty = computed(() => !!editor.value && JSON.stringify(editor.value) !== baseline.value);
    const uploads = ref<MediaUploadItem[]>([]);
    const uploadKeys = ref<Record<string, string>>({});
    const rows = computed(() => {
        const uploadedIds = new Set(uploads.value.flatMap(item => item.record ? [item.record.id] : []));
        return [
            ...uploads.value.map(upload => ({key: 'upload-' + upload.id, record: upload.record, upload})),
            ...result.value.items.filter(item => !uploadedIds.has(item.id)).map(record => ({
                key: uploadKeys.value[record.id] ?? record.id,
                record,
                upload: undefined
            })),
        ];
    });
    const deletions = ref<{
        id: string;
        name: string;
        state: 'waiting' | 'deleting' | 'success' | 'failed';
        error: string
    }[]>([]);

    function removeFailedUpload(id: number) {
        if (!busy.value) uploads.value = uploads.value.filter(item => item.id !== id || item.state !== 'failed');
    }

    let uploadId = 0;
    let sequence = 0, lifetime = 0;

    async function load(input?: Record<string, string | number | undefined>) {
        if (input) query = {...input}
        const serial = ++sequence, generation = session.generation;
        pending.value = true;
        loadError.value = '';
        try {
            const next = await api.list(query);
            if (serial === sequence && generation === session.generation) {
                result.value = next;
                uploads.value = uploads.value.filter(item => item.state !== 'success');
            }
        } catch (cause) {
            if (serial === sequence && generation === session.generation)
                loadError.value = request.message(cause);
        } finally {
            if (serial === sequence)
                pending.value = false;
        }
    }

    function edit(row: MediaRecord) {
        if (busy.value)
            return;
        editor.value = structuredClone(JSON.parse(JSON.stringify(row)));
        baseline.value = JSON.stringify(editor.value);
        error.value = '';
        notice.value = '';
    }

    function close() {
        if (!busy.value) {
            editor.value = null;
            baseline.value = '';
        }
    }

    async function perform(work: (active: () => boolean) => Promise<void>) {
        if (busy.value)
            return;
        busy.value = true;
        error.value = '';
        notice.value = '';
        const generation = session.generation, revision = lifetime;
        const active = () => generation === session.generation && revision === lifetime;
        try {
            await work(active);
            if (active() && notice.value) feedback.value = {
                message: notice.value,
                status: loadError.value || ((notice.value.startsWith('删除完成') && deletions.value.some(item => item.state === 'failed')) || (notice.value.startsWith('上传完成') && uploads.value.some(item => item.state === 'failed'))) ? 'warning' : 'success'
            };
        } catch (cause) {
            if (active())
                error.value = request.operationMessage(cause);
        } finally {
            if (active())
                busy.value = false;
        }
    }

    async function uploadFiles(files: File[], retryId?: number) {
        if (busy.value) return;
        if (retryId === undefined) uploads.value.push(...files.map(file => ({
            id: ++uploadId,
            file,
            progress: 0,
            state: 'waiting' as const,
            error: ''
        })));
        else {
            const row = uploads.value.find(item => item.id === retryId);
            if (row?.state === 'failed') {
                row.state = 'waiting';
                row.error = '';
                row.progress = 0;
            }
        }
        const batch = uploads.value.filter(item => item.state === 'waiting');
        if (!batch.length) return;
        await perform(async active => {
            for (const row of batch) {
                if (!active()) return;
                const limit = row.file.type === 'video/mp4' ? VIDEO_MAX_BYTES : MEDIA_MAX_BYTES;
                if (row.file.size > limit) {
                    row.state = 'failed';
                    row.error = '文件超过大小限制';
                    continue;
                }
                row.state = 'uploading';
                try {
                    const record = await api.upload(row.file, value => {
                        if (active()) row.progress = value;
                    });
                    if (!active()) return;
                    row.record = record;
                    uploadKeys.value[record.id] = 'upload-' + row.id;
                    row.state = 'success';
                    row.progress = 100;

                } catch (cause) {
                    if (!active()) return;
                    row.state = 'failed';
                    row.error = request.operationMessage(cause);
                }
            }
            if (active()) {
                const succeeded = batch.filter(item => item.state === 'success').length;
                notice.value = '上传完成：成功 ' + succeeded + ' 项，失败 ' + (batch.length - succeeded) + ' 项。';
                await load();
                if (loadError.value) notice.value += '列表刷新失败，请刷新后查看已上传媒体。';
                else uploads.value = uploads.value.filter(item => item.state !== 'success');
            }
        });
    }

    const upload = (file: File) => uploadFiles([file]);
    const retryUpload = (id: number) => uploadFiles([], id);

    async function save() {
        if (!editor.value)
            return;
        const {name, remark, version, id} = editor.value;
        const parsed = mediaUpdateSchema.safeParse({name, remark, version});
        if (!parsed.success) {
            error.value = parsed.error.issues.map(issue => issue.message).join('；');
            return;
        }
        await perform(async (active) => {
            const saved = await api.update(id, parsed.data);
            if (!active())
                return;
            editor.value = saved;
            baseline.value = JSON.stringify(saved);
            notice.value = '媒体资料已保存。';
            await load();
            if (loadError.value)
                notice.value = '媒体资料已保存，列表刷新失败，请重试。';
        });
    }

    async function remove(row: MediaRecord) {
        await perform(async (active) => {
            deletions.value = [
                {id: row.id, name: row.name, state: 'deleting', error: ''},
                ...deletions.value.filter(item => item.id !== row.id && item.state === 'failed'),
            ];
            const item = deletions.value[0]!;
            try {
                await api.remove(row.id, row.version);
            } catch (cause) {
                if (!active()) return;
                item.state = 'failed';
                item.error = request.operationMessage(cause);
                throw cause;
            }
            if (!active())
                return;
            item.state = 'success';
            removeFromList(row.id);
            notice.value = '媒体已删除。';
            await load();
            if (loadError.value)
                notice.value = '媒体已删除，列表刷新失败，请重试。';
        });
    }

    function removeFromList(id: string) {
        if (result.value.items.some(item => item.id === id)) {
            result.value.items = result.value.items.filter(item => item.id !== id);
            result.value.total = Math.max(0, result.value.total - 1);
        }
        uploads.value = uploads.value.filter(item => item.record?.id !== id);
    }

    async function removeMany(rows: MediaRecord[]) {
        if (busy.value || !rows.length) return;
        const targets = rows.filter(row => !row.references.length);
        deletions.value = targets.map(row => ({id: row.id, name: row.name, state: 'waiting', error: ''}));
        await perform(async active => {
            for (const row of targets) {
                if (!active()) return;
                const item = deletions.value.find(item => item.id === row.id)!;
                item.state = 'deleting';
                try {
                    await api.remove(row.id, row.version);
                    if (!active()) return;
                    removeFromList(row.id);
                    item.state = 'success';
                } catch (cause) {
                    if (!active()) return;
                    item.state = 'failed';
                    item.error = request.message(cause);
                    const failure = getAdminRequestFailure(cause);
                    const status = failure?.status ?? (cause as { statusCode?: number })?.statusCode ?? (cause as {
                        status?: number
                    })?.status;
                    if (status === 401 || status === 403 || status === 429 || (failure && ['UNAUTHENTICATED', 'FORBIDDEN', 'CSRF_REJECTED', 'PASSWORD_CHANGE_REQUIRED', 'RATE_LIMITED'].includes(failure.code))) {
                        for (const pending of deletions.value.filter(item => item.state === 'waiting')) {
                            pending.state = 'failed';
                            pending.error = '批量删除已停止，请刷新并确认权限后重试。';
                        }
                        break;
                    }
                }
            }
            if (!active()) return;
            const succeeded = deletions.value.filter(item => item.state === 'success').length;
            notice.value = `删除完成：成功 ${succeeded} 项，失败 ${deletions.value.length - succeeded} 项。`;
            await load();
            if (loadError.value) notice.value += '列表刷新失败，请刷新后确认结果。';
        });
    }

    function leave() {
        uploadKeys.value = {};
        sequence++;
        lifetime++;
        busy.value = false;
        pending.value = false;
        editor.value = null;
        baseline.value = '';
        error.value = '';
        loadError.value = '';
        notice.value = '';
        uploads.value = [];
        deletions.value = [];
        feedback.value = null;
    }

    watch(() => session.generation, () => {
        leave();
        result.value = {items: [], total: 0, page: 1, pageSize: 20};
        query = {page: 1, pageSize: 20}
    })
    return {
        rows,
        removeFailedUpload,
        feedback,
        deletions,
        removeMany,
        uploads,
        uploadFiles,
        retryUpload,
        result,
        pending,
        busy,
        error,
        loadError,
        notice,
        editor,
        dirty,
        load,
        edit,
        close,
        upload,
        save,
        remove,
        leave
    };
});
