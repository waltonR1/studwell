// 协调日志业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {logChangeSummary} from '#shared/utils/admin/log-changes'
import {readAuditChanges} from '../schemas/log-changes'
import {requireLogResult} from '../policies/log-result'
import {auditService} from './audit'
import type {Database} from '../db/transaction'
import {logRepository as repo, type LogRow, type LogQuery} from '../repositories/logs'
import {getPermissionSnapshot} from './access/permissions'
import {resolveListPageSize, resolveLogExportLimit} from './parameter-values'
import type {AuthMeta} from '../core/auth-context'
import {ApiError} from '../core/errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {paginationShape} from '#shared/schemas/admin/pagination'
import {logFilterSchema, logExportSchema, type LogFilter} from '#shared/schemas/admin/logs.ts'
import {logExportContextSchema, logCleanupContextSchema} from '../schemas/log-context'
import type {LogExportContext} from '#shared/types/admin/logs.ts'
import {logActionCatalog, logActionName} from '#shared/utils/admin/logs'
import {logNames, logResults, logReasonNames} from '#shared/config/admin/logs.ts'
import {type LogKind} from '#shared/types/admin/logs'
import type {LogRecord, LogList} from '#shared/types/admin/logs.ts'
import {beijingDate} from '#shared/utils/beijing-time.ts'
import {logDateRange} from '../policies/log-time'
import {logCsv} from './logs/csv'

const listSchema = logFilterSchema.safeExtend(paginationShape).refine(value => Number.isSafeInteger((value.page - 1) * value.pageSize), {
    path: ['page'],
    message: '页码超出范围'
})
type Snapshot = Awaited<ReturnType<typeof getPermissionSnapshot>>

// Root快照已经包含全部可用目录；仍不得绕过代码禁用的附加权限。
function can(snapshot: Snapshot, code: string) {
    return snapshot.permissions.includes(code)
}

function requirePermission(snapshot: Snapshot, code: string) {
    if (!can(snapshot, code)) throw new ApiError('FORBIDDEN')
}

function validateKind(kind: LogKind, filter: LogFilter) {
    if (filter.result && !logResults[kind].includes(filter.result)) throw new ApiError('INVALID_INPUT')
    if ((filter.action && !Object.hasOwn(logActionCatalog(kind), filter.action) && !(kind === 'audit' && filter.action === 'other'))) throw new ApiError('INVALID_INPUT')
}

function project(row: LogRow, kind: LogKind, snapshot: Snapshot, sources = can(snapshot, `system.logs.${kind}.sources.read`), exporting = false): LogRecord {
    let exportContext: LogExportContext | null = null, exportContextHidden = false
    if (row.exportContext !== null && row.exportContext !== undefined) {
        const parsed = logExportContextSchema.safeParse(row.exportContext)
        if (parsed.success && can(snapshot, `system.logs.${parsed.data.kind}.read`) && (!exporting || can(snapshot, `system.logs.${parsed.data.kind}.export`))) {
            exportContext = parsed.data
            if ((!sources || !can(snapshot, `system.logs.${parsed.data.kind}.sources.read`) || (exporting && !can(snapshot, `system.logs.${parsed.data.kind}.sources.export`))) && exportContext.filters.ip) {
                const filters = {...exportContext.filters};
                delete filters.ip
                exportContext = {...exportContext, filters};
                exportContextHidden = true
            }
        } else exportContextHidden = true
    }
    const cleanup = logCleanupContextSchema.safeParse(row.cleanupContext)
    return {
        changeContext: kind === 'audit' && row.result === 'success' ? readAuditChanges(row.changeContext, row.targetType) : null,
        cleanupContext: row.action === 'logs.cleanup' && cleanup.success ? cleanup.data : null,
        reasonCode: row.reasonCode && Object.hasOwn(logReasonNames, row.reasonCode) ? row.reasonCode : null,
        requestMethod: row.requestMethod ?? null,
        routeTemplate: row.routeTemplate ?? null,
        permissionCode: row.permissionCode ?? null,
        rateLimitScope: row.rateLimitScope ?? null,
        id: String(row.id),
        kind,
        actorId: row.actorId === null ? null : String(row.actorId),
        account: row.account,
        action: row.action,
        actionName: logActionName(kind, row.action),
        result: requireLogResult(row.result, kind),
        createdAt: row.createdAt.toISOString(),
        requestId: row.requestId,
        targetType: row.targetType,
        targetId: row.targetId,
        targetName: row.targetName,
        ip: sources ? row.ip : null,
        userAgent: sources ? row.userAgent : null,
        exportContext,
        exportContextHidden
    }
}

export function createLogService(database: Database, clock = () => new Date()) {
    async function query(kind: LogKind, filter: LogFilter, snapshot: Snapshot): Promise<LogQuery> {
        validateKind(kind, filter)
        if (filter.ip) requirePermission(snapshot, `system.logs.${kind}.sources.read`)
        return {...filter, ...logDateRange(filter, clock())}
    }

    return {
        async list(actor: bigint, kind: LogKind, input: unknown): Promise<LogList> {
            const snapshot = await getPermissionSnapshot(database, actor);
            requirePermission(snapshot, `system.logs.${kind}.read`)
            const parsed = await parseInput(listSchema, input)
            const pagination = (input as Record<string, unknown>).pageSize === undefined ? await parseInput(listSchema, {
                ...(input as Record<string, unknown>),
                pageSize: String(await resolveListPageSize(database))
            }) : parsed
            const filter = await query(kind, pagination, snapshot)
            const rows = await repo.rows(database, kind, filter, pagination.pageSize, (pagination.page - 1) * pagination.pageSize)
            return {
                items: rows.map(row => {
                    const record = project(row, kind, snapshot)
                    return {...record, changeSummary: logChangeSummary(record.changeContext), changeContext: undefined}
                }),
                total: await repo.total(database, kind, filter),
                page: pagination.page,
                pageSize: pagination.pageSize,
                exportLimit: await resolveLogExportLimit(database),
                range: {start: filter.start.toISOString(), endExclusive: filter.end.toISOString()}
            }
        },
        async detail(actor: bigint, kind: LogKind, raw: string) {
            const snapshot = await getPermissionSnapshot(database, actor);
            requirePermission(snapshot, `system.logs.${kind}.read`)
            const row = await repo.detail(database, kind, BigInt(await parseInput(entityIdSchema, raw)))
            if (!row) throw new ApiError('NOT_FOUND')
            return project(row, kind, snapshot)
        },
        async export(actor: bigint, kind: LogKind, input: unknown, meta: AuthMeta) {
            const parsed = await parseInput(logExportSchema, input)
            try {
                return await database.transaction(async tx => {
                    const snapshot = await getPermissionSnapshot(tx, actor)
                    requirePermission(snapshot, `system.logs.${kind}.read`);
                    requirePermission(snapshot, `system.logs.${kind}.export`)
                    if (parsed.includeSources || parsed.ip) {
                        requirePermission(snapshot, `system.logs.${kind}.sources.read`);
                        requirePermission(snapshot, `system.logs.${kind}.sources.export`)
                    }
                    const filter = await query(kind, parsed, snapshot)
                    // 一条查询获取筛选全集快照；只多读一行判断超限，不静默截断，不受当前页影响。
                    const limit = await resolveLogExportLimit(tx)
                    const rows = await repo.rows(tx, kind, filter, limit + 1)
                    if (rows.length > limit) throw new ApiError('EXPORT_LIMIT_EXCEEDED')
                    const records = rows.map(row => project(row, kind, snapshot, parsed.includeSources, true))
                    const csv = logCsv(records, parsed.includeSources)
                    const filters = Object.fromEntries(['account', 'actorId', 'action', 'result', 'ip', 'requestId', 'logId'].filter(key => parsed[key as keyof typeof parsed] !== undefined).map(key => [key, parsed[key as keyof typeof parsed]]))
                    const context = await parseInput(logExportContextSchema, {
                        version: 1,
                        kind,
                        start: filter.start.toISOString(),
                        endExclusive: filter.end.toISOString(),
                        filters,
                        rowCount: rows.length,
                        includeSources: parsed.includeSources
                    })
                    await auditService.write(tx, {
                        ...meta,
                        actorId: actor,
                        action: 'logs.export',
                        targetType: 'log_export',
                        targetName: `${logNames[kind]} CSV`,
                        result: 'success',
                        exportContext: context,
                        createdAt: clock()
                    })
                    const stamp = new Date(clock().getTime() + 8 * 3600000).toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-')
                    const lastDate = beijingDate(new Date(filter.end.getTime() - 1))
                    return {
                        csv,
                        filename: `${kind}-logs_${stamp}_${beijingDate(filter.start)}_${lastDate}.csv`,
                        rowCount: rows.length
                    }
                }, {isolationLevel: 'read committed'})
            } catch (error) {
                await auditService.failure(database, {
                    ...meta,
                    actorId: actor,
                    action: 'logs.export',
                    targetType: 'log_export',
                    targetName: `${logNames[kind]} CSV`,
                    result: 'failed',
                    createdAt: clock()
                }, error)
                throw error
            }
        },
    }
}
