import type {MediaRecord} from '#shared/types/admin/media'
export interface MediaUploadItem {
    record?: MediaRecord;
    id: number;
    file: File;
    progress: number;
    state: 'waiting' | 'uploading' | 'success' | 'failed';
    error: string;
}
