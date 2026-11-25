// 协调媒体业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import type {MediaByteRange} from '../core/media-range'
import {auditService} from './audit'
import { reportDiagnostic } from '../infrastructure/diagnostics';
import {auditedWrite, type AuditedResult} from './operations/audited-write';
import { auditChanges } from '../policies/audit-changes';
import type { Database, DatabaseTransaction } from '../db/transaction';
import type { AuthMeta } from '../core/auth-context';
import type { MediaStorage } from '../core/media-storage';
import type { MediaRecord,MediaReference } from '#shared/types/admin/media';
import {describeMediaReferences} from './media-references'
import { mediaRepository as repo } from '../repositories/media';
import { requirePermission } from './access/permissions';
import { parseInput } from '../core/validation';
import { ApiError, conflictError } from '../core/errors';
import { inspectMediaFile } from '../policies/media-file';
import { mediaMetadataSchema, mediaQuerySchema, mediaUpdateSchema } from '#shared/schemas/admin/media';
import { entityIdSchema, entityVersionSchema } from '#shared/schemas/entity';
import { resolveListPageSize } from './parameter-values';
type Row = NonNullable<Awaited<ReturnType<typeof repo.find>>>;
function dto(row: Row, createdByName: string, references: MediaReference[] = []): MediaRecord {
    return { id: String(row.id), name: row.name, originalName: row.originalName, kind: row.kind, mime: row.mime, size: row.size, width: row.width, height: row.height, remark: row.remark, references, createdByName, version: row.version, createdBy: String(row.createdBy), updatedBy: String(row.updatedBy), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function createMediaService(database: Database, storage: MediaStorage) {
    const write = <T>(actor: bigint, meta: AuthMeta, action: string, id: string | null, work: (tx: DatabaseTransaction) => Promise<AuditedResult<T>>) =>
        auditedWrite(database, {actor, meta, action, id, targetType: 'media', isolationLevel: 'read committed'}, work);
    async function fileResult(row: Row, range?: MediaByteRange) {
            if(range && row.kind==='video') {
                if(range.invalid || range.suffix===0)return {unsatisfied:true as const,size:row.size}
                const start=range.start ?? Math.max(0,row.size-(range.suffix ?? 0))
                const end=range.end===undefined?row.size-1:Math.min(range.end,row.size-1)
                if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=row.size||end<start)return {unsatisfied:true as const,size:row.size}
                return {unsatisfied:false as const,bytes:await storage.range(row.storageKey,start,end),mime:row.mime,kind:row.kind,size:row.size,start,end}
            }
            return {unsatisfied:false as const,bytes:await storage.read(row.storageKey),mime:row.mime,kind:row.kind,size:row.size,start:undefined,end:undefined};
    }
    return {
        async list(actor: bigint, input: unknown) {
            await requirePermission(database, actor, 'content.media.read');
            const parsed = await parseInput(mediaQuerySchema, input);
            const query = (input as Record<string, unknown>).pageSize === undefined ? await parseInput(mediaQuerySchema, { ...(input as Record<string, unknown>), pageSize: String(await resolveListPageSize(database)) }) : parsed;
            const result = await repo.list(database, query);
            const refs = await repo.references(database,result.items.map(row=>row.id));
            const descriptions=await describeMediaReferences(database,refs)
            const creators = await repo.creatorNames(database, result.items.map(row => row.createdBy));
            return { ...result, items: result.items.map(row => dto(row, creators.find(user => user.id === row.createdBy)?.name ?? '未知账号', refs.flatMap((ref,index)=>ref.mediaId===row.id?[descriptions[index]!]:[]))) };
        },
        async upload(actor: bigint, input: unknown, file: {
            bytes: Buffer;
            filename: string;
            mime: string;
        }, meta: AuthMeta) {
            await requirePermission(database, actor, 'content.media.create');
            const data = await parseInput(mediaMetadataSchema, input), info = inspectMediaFile(file.bytes, file.filename, file.mime);
            const extension=info.mime==='image/jpeg'?'jpg':info.mime==='image/vnd.microsoft.icon'?'ico':info.mime.split('/')[1]!;
            let storageKey: string
            try { storageKey = await storage.put(file.bytes, extension) }
            catch (cause) {
                await auditService.failure(database, {...meta, actorId: actor, action: 'media.create', targetType: 'media', targetName: data.name.slice(0, 80), result: 'failed', createdAt: new Date()}, cause)
                throw cause
            }
            try {
                return await write(actor, meta, 'media.create', null, async (tx) => {
                    await requirePermission(tx, actor, 'content.media.create');
                    const id = await repo.insert(tx, { ...data, ...info, storageKey, originalName: file.filename.slice(0, 255), createdBy: actor, updatedBy: actor });
                    return { value: dto((await repo.find(tx, id))!, (await repo.creatorNames(tx, [actor]))[0]?.name ?? '未知账号'), id: String(id), name: data.name, changes: auditChanges('media', null, data) };
                });
            }
            catch (error) {
                await storage.remove(storageKey).catch(cause => reportDiagnostic('media_storage', meta.requestId, cause));
                throw error;
            }
        },
        async update(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)), data = await parseInput(mediaUpdateSchema, input);
            return write(actor, meta, 'media.update', raw, async (tx) => {
                await requirePermission(tx, actor, 'content.media.update');
                const previous = await repo.find(tx, id, true);
                if (!previous)
                    throw new ApiError('NOT_FOUND');
                const { version, ...fields } = data;
                if (!await repo.update(tx, id, version, { ...fields, updatedBy: actor }))
                    throw conflictError('STALE', 'version');
                return { value: dto((await repo.find(tx, id))!, (await repo.creatorNames(tx, [previous.createdBy]))[0]?.name ?? '未知账号', await describeMediaReferences(tx,await repo.references(tx,[id]))), id: raw, name: fields.name, changes: auditChanges('media', {name: previous.name, remark: previous.remark}, fields) };
            });
        },
        async remove(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)), version = await parseInput(entityVersionSchema, input);
            let token: string | undefined;
            const operation = {actor,meta,action:'media.delete',id:raw,targetType:'media' as const,isolationLevel:'read committed' as const,targetName:undefined as string | undefined};
            try {
                const result = await auditedWrite(database,operation,async tx => {
                    await requirePermission(tx, actor, 'content.media.delete');
                    const row = await repo.find(tx,id,true);
                    if(!row) throw new ApiError('NOT_FOUND');
                    operation.targetName=row.name.slice(0,80);
                    if(row.version!==version) throw conflictError('STALE','version');
                    if((await repo.references(tx,[id])).length) throw conflictError('REFERENCED');
                    token = await storage.stage(row.storageKey);
                    if(!await repo.remove(tx,id,version))throw conflictError('STALE','version');
                    return {value:{deleted:true},id:raw,name:row.name,changes:auditChanges('media',{
                        name:row.name,originalName:row.originalName,storageKey:row.storageKey,kind:row.kind,mime:row.mime,size:row.size
                    },null)};
                });
                if(token)await storage.purge(token).catch(cause=>reportDiagnostic('media_storage',meta.requestId,cause));
                return result;
            } catch(error) {
                // 连接中断可能使提交结果未知，依据实际数据库状态决定恢复或清理。
                if(token) {
                    try {
                        const current=await repo.find(database,id);
                        if(current)await storage.restore(token);
                        else await storage.purge(token);
                    } catch (cause) { reportDiagnostic('media_storage', meta.requestId, cause) }
                }
                throw error;
            }
        },
        async publicFile(filename: string, range?: MediaByteRange) {
            if(!/^[a-f0-9-]{36}\.(png|jpg|webp|ico|mp4)$/.test(filename))throw new ApiError('NOT_FOUND');
            const row=await repo.findByStorageKey(database,`uploads/${filename}`);
            if(!row)throw new ApiError('NOT_FOUND');
            return fileResult(row,range);
        },
        async file(raw: string, actor: bigint, range?: MediaByteRange) {
            const id = BigInt(await parseInput(entityIdSchema, raw));
            await requirePermission(database, actor, 'content.media.read');
            const row = await repo.find(database, id);
            if (!row)
                throw new ApiError('NOT_FOUND');
            return fileResult(row,range);
        },
    };
}
