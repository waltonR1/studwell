// 负责字典的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
import {and, asc, count, desc, eq, like, or, sql, lt} from 'drizzle-orm'
import {adminDictionaries as dictionaries, adminDictionaryItems as items} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const dictionaryRepository = {
    async list(db: DatabaseExecutor, query: { page: number; pageSize: number; search?: string; status?: string }) {
        const keyword = query.search?.replace(/[\\%_]/g, '\\$&')
        const filter = and(query.status ? eq(dictionaries.enabled, query.status === 'enabled') : undefined, keyword ? or(like(dictionaries.name, `%${keyword}%`), like(dictionaries.code, `%${keyword}%`)) : undefined)
        const rows = await db.select({
            dictionary: dictionaries,
            optionCount: count(items.id),
            enabledOptionCount: sql<number>`coalesce(sum(case when
            ${items.enabled}
            =
            true
            then
            1
            else
            0
            end
            ),
            0
            )`,
        }).from(dictionaries).leftJoin(items, eq(items.dictionaryId, dictionaries.id)).where(filter).groupBy(dictionaries.id).orderBy(desc(dictionaries.createdAt), desc(dictionaries.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize)
        const [total] = await db.select({value: count()}).from(dictionaries).where(filter)
        return {items: rows, total: total!.value, page: query.page, pageSize: query.pageSize}
    },
    async find(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(dictionaries).where(eq(dictionaries.id, id)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async findByCode(db: DatabaseExecutor, code: string, lock = false) {
        const query = db.select().from(dictionaries).where(eq(dictionaries.code, code)).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    // 单条JOIN确保版本、父级状态和选项来自同一语句快照。
    async snapshot(db: DatabaseExecutor, id: bigint) {
        const rows = await db.select({
            dictionary: dictionaries,
            item: items
        }).from(dictionaries).leftJoin(items, eq(items.dictionaryId, dictionaries.id)).where(eq(dictionaries.id, id)).orderBy(asc(items.sortOrder), asc(items.id))
        return rows[0] ? {
            dictionary: rows[0].dictionary,
            items: rows.flatMap(row => row.item ? [row.item] : [])
        } : undefined
    },
    async snapshotByCode(db: DatabaseExecutor, code: string) {
        const row = await this.findByCode(db, code)
        return row ? this.snapshot(db, row.id) : undefined
    },
    async insert(db: DatabaseExecutor, input: typeof dictionaries.$inferInsert) {
        await db.insert(dictionaries).values(await withEntityIds(db, 'admin_dictionaries', input))
        const [row] = await db.select({id: dictionaries.id}).from(dictionaries).where(eq(dictionaries.code, input.code)).limit(1)
        return row!.id
    },
    async update(db: DatabaseExecutor, id: bigint, version: number, actor: bigint, fields: {
        name?: string;
        description?: string;
        enabled?: boolean
    }) {
        const [result] = await db.update(dictionaries).set({
            ...fields, version: sql`${dictionaries.version}
            + 1`, updatedBy: actor, updatedAt: new Date()
        }).where(and(eq(dictionaries.id, id), eq(dictionaries.version, version), lt(dictionaries.version, MAX_ENTITY_VERSION)))
        return result.affectedRows === 1
    },
    async insertItem(db: DatabaseExecutor, input: typeof items.$inferInsert) {
        await db.insert(items).values(await withEntityIds(db, 'admin_dictionary_items', input))
        const [row] = await db.select({id: items.id}).from(items).where(and(eq(items.dictionaryId, input.dictionaryId), eq(items.code, input.code))).limit(1)
        return row!.id
    },
    async findItem(db: DatabaseExecutor, id: bigint, dictionaryId: bigint, lock = false) {
        const query = db.select().from(items).where(and(eq(items.id, id), eq(items.dictionaryId, dictionaryId))).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async findItemByCode(db: DatabaseExecutor, dictionaryId: bigint, code: string, lock = false) {
        const query = db.select().from(items).where(and(eq(items.dictionaryId, dictionaryId), eq(items.code, code))).limit(1)
        const [row] = await (lock ? query.for('update') : query)
        return row
    },
    async updateItem(db: DatabaseExecutor, id: bigint, actor: bigint, fields: {
        name: string;
        sortOrder: number;
        enabled: boolean
    }) {
        await db.update(items).set({...fields, updatedBy: actor, updatedAt: new Date()}).where(eq(items.id, id))
    },
    async itemCount(db: DatabaseExecutor, dictionaryId: bigint) {
        const [row] = await db.select({value: count()}).from(items).where(eq(items.dictionaryId, dictionaryId))
        return row!.value
    },
}
