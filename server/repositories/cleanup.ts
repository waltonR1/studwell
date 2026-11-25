// 批次选择与删除必须使用调用方事务；SKIP LOCKED 避免多实例重复处理。
import {and, asc, inArray, lt, lte} from 'drizzle-orm'
import {adminAuthLogs, adminOperationLogs, adminRateLimits, adminSessions} from '../db/schema'
import type {DatabaseTransaction} from '../db/transaction'
import {loginActions, securityActions} from '#shared/config/admin/logs'
import type {LogKind} from '#shared/types/admin/logs'

export const cleanupRepository = {
    async sessions(tx: DatabaseTransaction, cutoff: Date, batchSize: number) {
        const rows = await tx.select({id: adminSessions.id}).from(adminSessions)
            .where(lte(adminSessions.expiresAt, cutoff)).orderBy(asc(adminSessions.expiresAt), asc(adminSessions.id))
            .limit(batchSize).for('update', {skipLocked: true})
        if (rows.length) await tx.delete(adminSessions).where(inArray(adminSessions.id, rows.map(row => row.id)))
        return rows.length
    },
    async rateLimits(tx: DatabaseTransaction, cutoff: Date, batchSize: number) {
        const rows = await tx.select({key: adminRateLimits.key}).from(adminRateLimits)
            .where(lte(adminRateLimits.windowStart, cutoff)).orderBy(asc(adminRateLimits.windowStart), asc(adminRateLimits.key))
            .limit(batchSize).for('update', {skipLocked: true})
        if (rows.length) await tx.delete(adminRateLimits).where(inArray(adminRateLimits.key, rows.map(row => row.key)))
        return rows.length
    },
    async logs(tx: DatabaseTransaction, kind: LogKind, cutoff: Date, batchSize: number) {
        const table = kind === 'audit' ? adminOperationLogs : adminAuthLogs
        const filter = and(lt(table.createdAt, cutoff), kind === 'audit' ? undefined
            : inArray(adminAuthLogs.action, Object.keys(kind === 'login' ? loginActions : securityActions)))
        const rows = await tx.select({id: table.id}).from(table).where(filter)
            .orderBy(asc(table.createdAt), asc(table.id)).limit(batchSize).for('update', {skipLocked: true})
        if (rows.length) await tx.delete(table).where(inArray(table.id, rows.map(row => row.id)))
        return rows.length
    },
}
