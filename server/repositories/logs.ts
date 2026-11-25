// 负责日志的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and, count, desc, eq, gte, inArray, lt, notInArray, sql, type SQL} from 'drizzle-orm'
import {adminAuthLogs as authLogs, adminOperationLogs as auditLogs, adminUsers} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import {logActionCatalog} from '#shared/utils/admin/logs'
import {loginActions, securityActions} from '#shared/config/admin/logs.ts'
import {type LogKind} from '#shared/types/admin/logs'
import type {LogFilter} from '#shared/schemas/admin/logs.ts'

export interface LogQuery extends LogFilter {
    start: Date;
    end: Date
}

function filter(kind: LogKind, query: LogQuery) {
    const table = kind === 'audit' ? auditLogs : authLogs
    const terms: (SQL | undefined)[] = [gte(table.createdAt, query.start), lt(table.createdAt, query.end), query.result ? eq(table.result, query.result) : undefined, query.ip ? eq(table.ip, query.ip) : undefined]
    if (query.requestId) terms.push(eq(table.requestId, query.requestId))
    if (query.logId) terms.push(eq(table.id, BigInt(query.logId)))
    if (kind === 'login') terms.push(inArray(authLogs.action, Object.keys(loginActions)))
    if (kind === 'security') terms.push(inArray(authLogs.action, Object.keys(securityActions)))
    if (query.actorId) terms.push(eq(kind === 'audit' ? auditLogs.actorId : authLogs.userId, BigInt(query.actorId)))
    if (query.account) terms.push(kind === 'audit' ? sql`${auditLogs.actorId}
    IN (SELECT
    ${adminUsers.id}
    FROM
    ${adminUsers}
    WHERE
    ${adminUsers.username}
    =
    ${query.account}
    )` : eq(authLogs.username, query.account))
    if (query.action) terms.push(query.action === 'other' ? notInArray(table.action, Object.keys(logActionCatalog(kind))) : eq(table.action, query.action))
    return and(...terms)
}

export interface LogRow {
    reasonCode?: string | null;
    requestMethod?: string | null;
    routeTemplate?: string | null;
    permissionCode?: string | null;
    rateLimitScope?: string | null
    id: bigint;
    actorId: bigint | null;
    account: string | null;
    action: string;
    result: string;
    createdAt: Date;
    requestId: string;
    ip: string;
    userAgent: string
    changeContext?: unknown
    cleanupContext?: unknown
    targetType: string | null;
    targetId: string | null;
    targetName: string | null;
    exportContext: unknown
}

export const logRepository = {
    async rows(db: DatabaseExecutor, kind: LogKind, query: LogQuery, limit: number, offset = 0): Promise<LogRow[]> {
        if (kind === 'audit') return db.select({
            reasonCode: auditLogs.reasonCode,
            id: auditLogs.id,
            actorId: auditLogs.actorId,
            account: adminUsers.username,
            action: auditLogs.action,
            result: auditLogs.result,
            createdAt: auditLogs.createdAt,
            requestId: auditLogs.requestId,
            ip: auditLogs.ip,
            userAgent: auditLogs.userAgent,
            targetType: auditLogs.targetType,
            targetId: auditLogs.targetId,
            targetName: auditLogs.targetName,
            exportContext: auditLogs.exportContext,
            cleanupContext: auditLogs.cleanupContext,
            changeContext: auditLogs.changeContext
        }).from(auditLogs).leftJoin(adminUsers, eq(adminUsers.id, auditLogs.actorId)).where(filter(kind, query)).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit).offset(offset)
        const rows = await db.select().from(authLogs).where(filter(kind, query)).orderBy(desc(authLogs.createdAt), desc(authLogs.id)).limit(limit).offset(offset)
        return rows.map(row => ({
            ...row,
            actorId: row.userId,
            account: row.username,
            targetType: null,
            targetId: null,
            targetName: null,
            exportContext: null
        }))
    },
    async total(db: DatabaseExecutor, kind: LogKind, query: LogQuery) {
        const table = kind === 'audit' ? auditLogs : authLogs
        const [row] = await db.select({value: count()}).from(table).where(filter(kind, query))
        return row!.value
    },
    async detail(db: DatabaseExecutor, kind: LogKind, id: bigint): Promise<LogRow | undefined> {
        if (kind === 'audit') {
            const [row] = await db.select({
                reasonCode: auditLogs.reasonCode,
                id: auditLogs.id,
                actorId: auditLogs.actorId,
                account: adminUsers.username,
                action: auditLogs.action,
                result: auditLogs.result,
                createdAt: auditLogs.createdAt,
                requestId: auditLogs.requestId,
                ip: auditLogs.ip,
                userAgent: auditLogs.userAgent,
                targetType: auditLogs.targetType,
                targetId: auditLogs.targetId,
                targetName: auditLogs.targetName,
                exportContext: auditLogs.exportContext,
                cleanupContext: auditLogs.cleanupContext,
            changeContext: auditLogs.changeContext
            }).from(auditLogs).leftJoin(adminUsers, eq(adminUsers.id, auditLogs.actorId)).where(eq(auditLogs.id, id)).limit(1)
            return row
        }
        const [row] = await db.select().from(authLogs).where(and(eq(authLogs.id, id), kind === 'login' ? inArray(authLogs.action, Object.keys(loginActions)) : inArray(authLogs.action, Object.keys(securityActions)))).limit(1)
        return row ? {
            ...row,
            actorId: row.userId,
            account: row.username,
            targetType: null,
            targetId: null,
            targetName: null,
            exportContext: null
        } : undefined
    },
}
