import type { AdminUploadClient } from '~/types/admin/api';
import type { MediaList, MediaRecord } from '#shared/types/admin/media';
import type { MediaMetadata } from '#shared/schemas/admin/media';
export function createMediaApi(api: AdminUploadClient) {
    return {
        list: (query: Record<string, string | number | undefined>) => api.read<MediaList>('media', query),
        upload: (file: File, progress?: (value:number)=>void) => api.upload<MediaRecord>('media', file, {filename:file.name}, progress),
        update: (id: string, data: MediaMetadata & {
            version: number;
        }) => api.mutate<MediaRecord>(`media/${id}`, 'PUT', data),
        remove: (id: string, version: number) => api.mutate(`media/${id}`, 'DELETE', { version }),
    };
}

export const adminMediaFileUrl = (id: string) => `/api/admin/media/${encodeURIComponent(id)}/file`
