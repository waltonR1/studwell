import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {sql} from 'drizzle-orm'
import {setupTestDatabase, cleanTestDatabase} from './support'
import {allocateEntityIds, withEntityIds} from '../../server/db/allocate-entity-id'
import {decodeEntityId, entityIdTypes} from '../../server/db/entity-ids'
import {adminUsers, adminTasks} from '../../server/db/schema'
import {resetTestData} from './reset-data'
import {seedRoot} from '../../scripts/database/seed/system'

let client: Awaited<ReturnType<typeof setupTestDatabase>>
beforeAll(async () => { client = await setupTestDatabase() })
afterAll(async () => { if (client) await cleanTestDatabase(client) })

describe('统一实体编号', () => {
    it('类型目录覆盖所有原自增实体，批量编号不丢精度', async () => {
        for (const [table, type] of Object.entries(entityIdTypes)) {
            const ids = await allocateEntityIds(client.database, table as keyof typeof entityIdTypes, 3)
            expect(ids[2]! - ids[0]!).toBe(2n)
            for (const id of ids) {
                expect(decodeEntityId(String(id))).toMatchObject({table, type})
                expect(id).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER))
            }
        }
    })
    it('多个连接并发首次创建计数器不重复', async () => {
        const batches = await Promise.all(Array.from({length: 20}, () => allocateEntityIds(client.database, 'admin_roles', 5, new Date('2097-03-01T00:00:00Z'))))
        const values = batches.flat().map(String)
        expect(new Set(values).size).toBe(100)
        expect(values.every(value => value.startsWith('2097030102'))).toBe(true)
    })
    it('北京时间跨日独立计数，回拨继续旧日期高水位', async () => {
        const [a] = await allocateEntityIds(client.database, 'admin_roles', 1, new Date('2097-04-01T15:59:59Z'))
        const [b] = await allocateEntityIds(client.database, 'admin_roles', 1, new Date('2097-04-01T16:00:00Z'))
        const [c] = await allocateEntityIds(client.database, 'admin_roles', 1, new Date('2097-04-01T15:59:58Z'))
        expect(String(a)).toBe('2097040102000000001')
        expect(String(b)).toBe('2097040202000000001')
        expect(c).toBe(a! + 1n)
    })
    it('事务回滚同时撤销计数；流水耗尽拒绝写入', async () => {
        const now = new Date('2097-05-01T00:00:00Z')
        await expect(client.database.transaction(async tx => {
            await allocateEntityIds(tx, 'admin_roles', 3, now)
            throw new Error('ROLLBACK_FIXTURE')
        })).rejects.toThrow('ROLLBACK_FIXTURE')
        const [id] = await allocateEntityIds(client.database, 'admin_roles', 1, now)
        expect(String(id)).toBe('2097050102000000001')
        await client.database.execute(sql`UPDATE admin_entity_id_counters SET sequence_value = 999999999 WHERE counter_key = '2097050102'`)
        await expect(allocateEntityIds(client.database, 'admin_roles', 1, now)).rejects.toThrow()
        await expect(allocateEntityIds(client.database, 'admin_roles', 0)).rejects.toThrow('ENTITY_ID_COUNT_INVALID')
    })
    it('遗漏分配的写入立即失败，原生SQL不能退回自增', async () => {
        await expect(client.database.insert(adminUsers).values({username: 'missing_id', displayName: 'Missing', passwordHash: 'fixture'})).rejects.toThrow('ENTITY_ID_REQUIRED')
        await expect(client.pool.query("INSERT INTO admin_users (username,display_name,password_hash) VALUES ('raw_missing','Raw','fixture')")).rejects.toThrow()
        await expect(withEntityIds(client.database, 'admin_users', {id: 1n})).rejects.toThrow('ENTITY_ID_MUST_BE_GENERATED')
    })
    it('重建测试数据保留Root凭据，重新编号并初始化任务和目录', async () => {
        const root = await seedRoot(client.database, 'Entity fixture Aurora 8462!')
        const [before] = await client.database.select().from(adminUsers)
        await resetTestData(client.database)
        const [after] = await client.database.select().from(adminUsers)
        expect(after!.passwordHash).toBe(before!.passwordHash)
        expect(String(after!.id)).not.toBe(root.id)
        expect(decodeEntityId(String(after!.id))?.table).toBe('admin_users')
        const tasks = await client.database.select().from(adminTasks)
        expect(tasks).toHaveLength(4)
        expect(tasks.every(task => decodeEntityId(String(task.id))?.table === 'admin_tasks')).toBe(true)
    })
})
