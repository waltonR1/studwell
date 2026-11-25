// 负责系统参数的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {and, asc, eq, sql, lt} from 'drizzle-orm'
import {adminParameters} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const parameterRepository = {
    async all(db: DatabaseExecutor, lock = false) {
        const query = db.select().from(adminParameters).orderBy(asc(adminParameters.id))
        return lock ? query.for('update') : query
    },
    async find(db: DatabaseExecutor, key: string, lock = false) {
        const query = db.select().from(adminParameters).where(eq(adminParameters.key, key)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async findById(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(adminParameters).where(eq(adminParameters.id, id)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async update(db: DatabaseExecutor, id: bigint, version: number, value: string | null, actor: bigint) {
        const [result] = await db.update(adminParameters).set({
            value, version: sql`${adminParameters.version}
            + 1`, updatedBy: actor, updatedAt: new Date()
        }).where(and(eq(adminParameters.id, id), eq(adminParameters.version, version), lt(adminParameters.version, MAX_ENTITY_VERSION)))
        return result.affectedRows === 1
    },
}
