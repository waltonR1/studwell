// 负责账号的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
// 账号持久化：所有操作显式使用传入的连接/事务，不决定业务授权或 HTTP。
import {and, eq, isNull, sql, lt, inArray} from 'drizzle-orm'
import {adminUsers} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export type AccountRow = typeof adminUsers.$inferSelect
export type NewAccount = Pick<typeof adminUsers.$inferInsert, 'username' | 'displayName' | 'email' | 'phone' | 'department' | 'position' | 'remark' | 'passwordHash' | 'isRoot' | 'createdBy' | 'updatedBy'>
export const accountRepository = {
    // 历史署名只读取账号标识；停用或软删除后仍可展示原账号用户名。
    identities(db:DatabaseExecutor,ids:bigint[]){
        return ids.length?db.select({id:adminUsers.id,username:adminUsers.username,enabled:adminUsers.enabled,deletedAt:adminUsers.deletedAt}).from(adminUsers).where(inArray(adminUsers.id,[...new Set(ids)])):Promise.resolve([])
    },
    async findByUsername(db: DatabaseExecutor, username: string) {
        const [row] = await db.select().from(adminUsers).where(eq(adminUsers.activeUsername, username)).limit(1)
        return row
    },
    async findById(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async rehash(db: DatabaseExecutor, id: bigint, passwordHash: string) {
        await db.update(adminUsers).set({passwordHash}).where(eq(adminUsers.id, id))
    },
    async insert(db: DatabaseExecutor, input: NewAccount) {
        await db.insert(adminUsers).values(await withEntityIds(db, 'admin_users', input))
        return this.findByUsername(db, input.username)
    },
    async updateOrdinary(db: DatabaseExecutor, id: bigint, version: number, actorId: bigint, changes: {
        displayName?: string;
        email?: string | null;
        phone?: string | null;
        department?: string | null;
        position?: string | null;
        remark?: string | null;
        enabled?: boolean;
        passwordHash?: string;
        mustChangePassword?: boolean;
        deletedAt?: Date
    }) {
        const [result] = await db.update(adminUsers).set({
            ...changes,
            updatedBy: actorId,
            updatedAt: new Date(),
            version: sql`${adminUsers.version}
            + 1`
        })
            .where(and(eq(adminUsers.id, id), eq(adminUsers.version, version), lt(adminUsers.version, MAX_ENTITY_VERSION), eq(adminUsers.isRoot, false), isNull(adminUsers.deletedAt)))
        return result.affectedRows === 1
    },
}
