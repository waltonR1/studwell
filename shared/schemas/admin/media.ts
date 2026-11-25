// 媒体库查询与元数据更新的跨端输入校验，文件检查和存储由服务端负责。
import {z} from 'zod';
import {entityVersionSchema} from '../entity';
import {listQuerySchema} from './pagination';

export const mediaMetadataSchema = z.strictObject({
    name: z.string().trim().min(1).max(160),
    remark: z.string().trim().max(1000)
});
export const mediaUpdateSchema = mediaMetadataSchema.extend({version: entityVersionSchema});
export const mediaQuerySchema = listQuerySchema.safeExtend({kind: z.enum(['image', 'video']).optional()});
export type MediaMetadata = z.infer<typeof mediaMetadataSchema>;
