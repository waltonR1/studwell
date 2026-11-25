// 后台媒体记录与列表响应，不包含文件存储或上传实现。
import type {MediaMetadata} from '../../schemas/admin/media';

export interface MediaReference {
    owner:string;
    field:string;
    source:string;
    status:string;
    location:string;
    locationKey:string;
    locale:string|null;
}

export interface MediaRecord extends MediaMetadata {
    id: string;
    version: number;
    kind: 'image' | 'video';
    mime: string;
    size: number;
    width: number | null;
    height: number | null;
    originalName: string;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
    references: MediaReference[];
    createdByName: string;
}

export interface MediaList {
    items: MediaRecord[];
    total: number;
    page: number;
    pageSize: number;
}
