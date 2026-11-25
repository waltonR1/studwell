// 校验日志导出与清理任务的持久化上下文。
import {TASK_RETENTION_DAYS} from '#shared/config/admin/tasks'
import {CLEANUP_BATCH_SIZE, CLEANUP_MAX_BATCHES} from '../config/cleanup'
// 服务端审计上下文校验；输出结构必须符合共享传输契约。
import {entityIdSchema} from '#shared/schemas/entity.ts'
import {z} from 'zod'
import {LOG_EXPORT_HARD_LIMIT, logKinds, logResultCodes} from '#shared/config/admin/logs.ts'
import type {LogExportContext, LogCleanupContext} from '#shared/types/admin/logs.ts'

const id = entityIdSchema
// 仅导出事件使用的受限审计结构；不是通用JSON快照入口。
export const logExportContextSchema = z.strictObject({
    version: z.literal(1), kind: z.enum(logKinds), start: z.iso.datetime(), endExclusive: z.iso.datetime(),
    filters: z.strictObject({
        requestId: z.uuid().optional(),
        logId: id.optional(),
        account: z.string().max(64).optional(),
        actorId: id.optional(),
        action: z.string().max(40).optional(),
        result: z.enum(logResultCodes).optional(),
        ip: z.string().max(45).optional()
    }),
    rowCount: z.number().int().min(0).max(LOG_EXPORT_HARD_LIMIT), includeSources: z.boolean(),
}) satisfies z.ZodType<LogExportContext>
export const logCleanupContextSchema = z.strictObject({
    version: z.literal(1),
    kind: z.enum(logKinds),
    retentionDays: z.number().int().min(TASK_RETENTION_DAYS.min).max(TASK_RETENTION_DAYS.max),
    cutoff: z.iso.datetime(),
    deletedCount: z.number().int().min(0).max(CLEANUP_BATCH_SIZE),
    batch: z.number().int().min(1).max(CLEANUP_MAX_BATCHES),
    limitReached: z.boolean()
}) satisfies z.ZodType<LogCleanupContext>
