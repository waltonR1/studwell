// 账号管理查询与关联持久化；不决定授权或 HTTP。
import {and, asc, count, desc, eq, inArray, isNull, like, or, max, sql, gt} from 'drizzle-orm'
import {adminUsers, adminRoles, adminUserRoles, adminAuthLogs, adminSessions} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const userRepository = {
    async identities(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select({
            id: adminUsers.id,
            displayName: adminUsers.displayName
        }).from(adminUsers).where(inArray(adminUsers.id, ids)) : []
    },
    async userRoles(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select({
            userId: adminUserRoles.userId,
            roleId: adminUserRoles.roleId,
            name: adminRoles.name,
            enabled: adminRoles.enabled
        }).from(adminUserRoles).innerJoin(adminRoles, eq(adminUserRoles.roleId, adminRoles.id)).where(inArray(adminUserRoles.userId, ids)).orderBy(asc(adminRoles.id)) : []
    },
    async lastLogins(db: DatabaseExecutor, ids: bigint[]) {
        return ids.length ? db.select({
            userId: adminAuthLogs.userId,
            at: max(adminAuthLogs.createdAt)
        }).from(adminAuthLogs).where(and(inArray(adminAuthLogs.userId, ids), eq(adminAuthLogs.action, 'login'), eq(adminAuthLogs.result, 'success'))).groupBy(adminAuthLogs.userId) : []
    },
    async activeSessions(db: DatabaseExecutor, userId: bigint, now: Date) {
        const [row] = await db.select({
            count: count(),
            lastActivityAt: max(adminSessions.lastActivityAt)
        }).from(adminSessions).where(and(eq(adminSessions.userId, userId), gt(adminSessions.expiresAt, now), sql`TIMESTAMPDIFF
        (MICROSECOND,
        ${adminSessions.lastActivityAt},
        ${now}
        )
        <
        ${adminSessions.idleTimeoutMs}
        *
        1000`))
        return {count: row!.count, lastActivityAt: row!.lastActivityAt?.toISOString() ?? null}
    },
    async list(db: DatabaseExecutor, query: { page: number; pageSize: number; search?: string; status?: string }) {
        const keyword = query.search?.replace(/[\\%_]/g, '\\$&')
        const filter = and(isNull(adminUsers.deletedAt), query.status ? eq(adminUsers.enabled, query.status === 'enabled') : undefined, keyword ? or(like(adminUsers.username, `%${keyword}%`), like(adminUsers.displayName, `%${keyword}%`)) : undefined)
        const items = await db.select().from(adminUsers).where(filter).orderBy(desc(adminUsers.createdAt), desc(adminUsers.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize)
        const [total] = await db.select({value: count()}).from(adminUsers).where(filter)
        return {items, total: total!.value, page: query.page, pageSize: query.pageSize}
    },
    async roles(db: DatabaseExecutor, lock = false) {
        const query = db.select().from(adminRoles).orderBy(asc(adminRoles.id));
        return lock ? query.for('update') : query
    },
    async roleIds(db: DatabaseExecutor, userId: bigint) {
        return (await db.select({id: adminUserRoles.roleId}).from(adminUserRoles).where(eq(adminUserRoles.userId, userId))).map(row => row.id)
    },
    async replace(db: DatabaseExecutor, userId: bigint, ids: bigint[]) {
        await db.delete(adminUserRoles).where(eq(adminUserRoles.userId, userId));
        if (ids.length) await db.insert(adminUserRoles).values(ids.map(roleId => ({userId, roleId})))
    },
}
