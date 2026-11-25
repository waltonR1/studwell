// 在传入数据库上下文中分配实体 ID，保证业务写入使用同一事务。
import {sql} from 'drizzle-orm'
import type {DatabaseExecutor} from './transaction'
import {entityIdTypes, type EntityTable} from './entity-ids'

// 单条原子 UPSERT 的结果返回所占区间末值，不依赖连接池上的后续 SELECT。
// 使用当前事务：回滚会同时撤销编号与实体，未提交的编号不得对外发布。
export async function allocateEntityIds(db: DatabaseExecutor, table: EntityTable, count = 1, now = new Date()): Promise<bigint[]> {
    if (!Number.isSafeInteger(count) || count < 1 || count > 10000) throw new Error('ENTITY_ID_COUNT_INVALID')
    if (!Number.isFinite(now.getTime())) throw new Error('ENTITY_ID_DATE_INVALID')
    const date = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10).replaceAll('-', '')
    if (!/^[1-9]\d{7}$/.test(date)) throw new Error('ENTITY_ID_DATE_INVALID')
    if (!Object.hasOwn(entityIdTypes, table)) throw new Error('ENTITY_ID_TYPE_INVALID')
    const prefix = date + entityIdTypes[table]
    const [result] = await db.execute(sql`
        INSERT INTO admin_entity_id_counters (counter_key, sequence_value)
        VALUES (${prefix}, LAST_INSERT_ID(${count}))
        ON DUPLICATE KEY UPDATE sequence_value = IF(sequence_value + ${count} <= 999999999, LAST_INSERT_ID(sequence_value + ${count}), NULL)
    `)
    const end = Number(result.insertId)
    if (!Number.isSafeInteger(end) || end < count || end > 999999999) throw new Error('ENTITY_ID_SEQUENCE_INVALID')
    return Array.from({length: count}, (_, index) => BigInt(prefix + String(end - count + index + 1).padStart(9, '0')))
}

export async function withEntityIds<T extends object>(db: DatabaseExecutor, table: EntityTable, input: T[]): Promise<Array<T & {id: bigint}>>
export async function withEntityIds<T extends object>(db: DatabaseExecutor, table: EntityTable, input: T): Promise<T & {id: bigint}>
export async function withEntityIds<T extends object>(db: DatabaseExecutor, table: EntityTable, input: T | T[]) {
    const rows = Array.isArray(input) ? input : [input]
    if (rows.some(row => 'id' in row && row.id !== undefined)) throw new Error('ENTITY_ID_MUST_BE_GENERATED')
    if (!rows.length) return []
    const ids = await allocateEntityIds(db, table, rows.length)
    const values = rows.map((row, index) => ({...row, id: ids[index]!}))
    return Array.isArray(input) ? values : values[0]!
}
