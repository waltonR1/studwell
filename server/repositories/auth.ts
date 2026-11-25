// 负责认证与会话的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
import type {LogResult} from '#shared/types/admin/logs'
import {requireLogResult} from '../policies/log-result'
// 认证持久化，所有查询显式使用当前连接或事务；不决定 HTTP/业务授权。
import {and, eq, sql, lt} from 'drizzle-orm'
import {adminAuthLogs, adminRateLimits, adminSessions, adminUsers} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const authRepository = {
    async session(db: DatabaseExecutor, tokenHash: string, lock = false) {
        const query = db.select().from(adminSessions).where(eq(adminSessions.tokenHash, tokenHash)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async user(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async insertSession(db: DatabaseExecutor, data: typeof adminSessions.$inferInsert) {
        await db.insert(adminSessions).values(await withEntityIds(db, 'admin_sessions', data))
    },
    async deleteSession(db: DatabaseExecutor, tokenHash: string) {
        await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash))
    },
    async revokeUser(db: DatabaseExecutor, userId: bigint) {
        await db.delete(adminSessions).where(eq(adminSessions.userId, userId))
    },
    async touch(db: DatabaseExecutor, tokenHash: string, now: Date) {
        await db.update(adminSessions).set({lastActivityAt: now}).where(eq(adminSessions.tokenHash, tokenHash))
    },
    async log(db: DatabaseExecutor, data: Omit<typeof adminAuthLogs.$inferInsert, 'result'> & {result: LogResult}) {
        const row = await withEntityIds(db, 'admin_auth_logs', {...data, result: requireLogResult(data.result, data.action === 'login' || data.action === 'logout' ? 'login' : 'security')})
        await db.insert(adminAuthLogs).values(row)
        return row.id
    },
    async consume(db: DatabaseExecutor, key: string, now: Date, cutoff: Date) {
        await db.insert(adminRateLimits).values({key, hits: 1, windowStart: now}).onDuplicateKeyUpdate({
            set: {
                hits: sql`IF
                (
                ${adminRateLimits.windowStart}
                <=
                ${cutoff},
                1,
                LEAST
                (
                ${adminRateLimits.hits}
                +
                1,
                4294967295
                )
                )`,
                windowStart: sql`IF
                (
                ${adminRateLimits.windowStart}
                <=
                ${cutoff},
                ${now},
                ${adminRateLimits.windowStart}
                )`,
            }
        })
        const [row] = await db.select().from(adminRateLimits).where(eq(adminRateLimits.key, key)).for('update')
        return row!
    },
    async replacePassword(db: DatabaseExecutor, id: bigint, version: number, passwordHash: string, now: Date) {
        const [result] = await db.update(adminUsers).set({
            passwordHash,
            mustChangePassword: false,
            version: sql`${adminUsers.version}
            + 1`,
            updatedBy: id,
            updatedAt: now
        })
            .where(and(eq(adminUsers.id, id), eq(adminUsers.version, version), lt(adminUsers.version, MAX_ENTITY_VERSION)))
        return result.affectedRows === 1
    },
}
