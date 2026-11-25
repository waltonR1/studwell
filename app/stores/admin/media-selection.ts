import {reactive, watch} from 'vue'
import {defineStore} from 'pinia'
import {createMediaApi} from '~/api/admin/media'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
import type {MediaRecord} from '#shared/types/admin/media'
import {MEDIA_MAX_BYTES,VIDEO_MAX_BYTES} from '#shared/config/admin/media'
import {DEFAULT_ADMIN_PAGE_SIZE} from '#shared/config/admin/pagination'

type Slot = string
const empty = () => ({items: [] as MediaRecord[], pending: false, error: '', search: '', page: 1, requestedPage: 1, total: 0, uploading: false, progress: 0, uploadError: ''})
// Selection has its own scopes; it never overwrites the media library's list/editor.
export const useAdminMediaSelectionStore = defineStore('admin-media-selection', () => {
    const request = useAdminRequestStore(), session = useAdminSessionStore(), api = createMediaApi(request)
    const selections = reactive<Record<string, ReturnType<typeof empty>>>({logoId: empty(), faviconId: empty()})
    const revisions: Record<Slot, number> = {logoId: 0, faviconId: 0}

    function selection(slot: Slot) {
        selections[slot] ??= empty();
        revisions[slot] ??= 0;
        return selections[slot]!
    }

    function leave(slot: Slot) {
        selection(slot);
        revisions[slot] = (revisions[slot] ?? 0) + 1;
        delete selections[slot]
    }

    async function load(slot: Slot, page = 1, kind: 'image' | 'video' | 'any' = 'image') {
        if (!session.can('content.media.read')) return
        const state = selection(slot), revision = revisions[slot] = (revisions[slot] ?? 0) + 1,
            generation = session.generation
        state.pending = true;
        state.error = '';
        state.requestedPage = page
        try {
            const result = await api.list({
                ...(kind === 'any' ? {} : {kind}),
                page,
                pageSize: DEFAULT_ADMIN_PAGE_SIZE,
                search: state.search || undefined
            })
            if (revision !== revisions[slot] || generation !== session.generation) return
            state.items = result.items;
            state.total = result.total
            state.page = page
        } catch (error) {
            if (revision === revisions[slot] && generation === session.generation) state.error = request.message(error)
        } finally {
            if (revision === revisions[slot] && generation === session.generation) state.pending = false
        }
    }

    async function upload(slot: Slot, file: File, kind: 'image' | 'video' | 'any' = 'image') {
        const state = selection(slot)
        if (state.uploading || !session.can('content.media.read') || !session.can('content.media.create')) return null
        state.uploadError = ''
        const fileKind = file.type.startsWith('video/') || /\.mp4$/i.test(file.name) ? 'video' : 'image'
        const limit = (kind === 'any' ? fileKind : kind) === 'video' ? VIDEO_MAX_BYTES : MEDIA_MAX_BYTES
        if (file.size > limit) {state.uploadError = '文件超过大小限制'; return null}
        if (kind === 'image' && (file.type.startsWith('video/') || /\.mp4$/i.test(file.name))) {state.uploadError = '请选择图片文件'; return null}
        if (kind === 'video' && file.type !== 'video/mp4' && !/\.mp4$/i.test(file.name)) {state.uploadError = '请选择 MP4 视频'; return null}
        const revision = revisions[slot] = (revisions[slot] ?? 0) + 1, generation = session.generation
        state.pending = false
        state.uploading = true
        state.progress = 0
        try {
            const record = await api.upload(file, progress => {
                if (revision === revisions[slot] && generation === session.generation) state.progress = progress
            })
            if (revision !== revisions[slot] || generation !== session.generation) return null
            if (kind !== 'any' && record.kind !== kind) {state.uploadError = '文件已上传，但类型与当前字段不符，请到媒体库查看。'; return null}
            return record
        } catch (error) {
            if (revision === revisions[slot] && generation === session.generation) state.uploadError = request.operationMessage(error)
            return null
        } finally {
            if (revision === revisions[slot] && generation === session.generation) state.uploading = false
        }
    }

    watch(() => session.generation, () => {
        for (const slot of Object.keys(selections)) leave(slot)
    })
    return {selections, selection, load, upload, leave, pageSize: DEFAULT_ADMIN_PAGE_SIZE}
})
