import {rateCleanupCutoff} from '../../server/policies/cleanup'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import { adminOperationLogs, adminRateLimits, adminSessions } from '../../server/db/schema'
import { cleanupAuthState } from '../../server/services/cleanup/auth-cleanup'
import { authRepository } from '../../server/repositories/auth'
import { auditRepository } from '../../server/repositories/audit'

let client: Awaited<ReturnType<typeof setupTestDatabase>>
const now = new Date('2026-10-26T04:00:00Z'), clock = () => now
beforeAll(async () => { client = await setupTestDatabase() })
beforeEach(async () => {
  await client.database.delete(adminSessions); await client.database.delete(adminRateLimits); await client.database.delete(adminOperationLogs)
})
afterAll(async () => { if (client) await cleanTestDatabase(client) })
async function sessions(times: Date[]) {
  await client.database.insert(adminSessions).values(await withEntityIds(client.database, 'admin_sessions', times.map((expiresAt, index) => ({ tokenHash: String(index + 1).padStart(64, '0'), idleTimeoutMs: 60_000, createdAt: new Date(now.getTime() - 2 * 86400_000), lastActivityAt: new Date(now.getTime() - 3600_000), expiresAt }))))
}
async function rates(times: Date[]) {
  await client.database.insert(adminRateLimits).values(times.map((windowStart, index) => ({ key: `fixture-${index}`, windowStart, hits: 10 })))
}
describe('认证残留回收真实数据库', () => {
  it('会话绝对到期边界与最长限流窗口；保留仍有效窗口和仅空闲失效的会话', async () => {
    await sessions([new Date(now.getTime() - 1), now, new Date(now.getTime() + 1)])
    const cutoff = rateCleanupCutoff(now)
    await rates([new Date(cutoff.getTime() - 1), cutoff, new Date(cutoff.getTime() + 1), now])
    const result = await cleanupAuthState(client.database, clock)
    expect(result.results.map(row => row.deletedCount)).toEqual([2, 2])
    expect(await client.database.select().from(adminSessions)).toHaveLength(1)
    expect(await client.database.select().from(adminRateLimits)).toHaveLength(2)
    const audit = await client.database.select().from(adminOperationLogs)
    expect(audit).toHaveLength(2)
    expect(audit.every(row => row.actorId === null && row.targetType === 'maintenance' && row.requestId === result.requestId)).toBe(true)
    const serialized = JSON.stringify(audit, (_key, value) => typeof value === 'bigint' ? value.toString() : value)
    expect(serialized).not.toContain('fixture-')
    expect(serialized).not.toContain('0000000000000000000000000000000000000000000000000000000000000001')
    await cleanupAuthState(client.database, clock)
    expect(await client.database.select().from(adminOperationLogs)).toHaveLength(2)
  })
  it('每类有独立批量上限，可重复执行补齐余量', async () => {
    await sessions(Array.from({ length: 5 }, () => new Date(now.getTime() - 1)))
    await rates(Array.from({ length: 5 }, () => rateCleanupCutoff(now)))
    expect((await cleanupAuthState(client.database, clock, { batchSize: 2, maxBatches: 2 })).results).toEqual([
      { kind: 'sessions', deletedCount: 4, limitReached: true }, { kind: 'rate_limits', deletedCount: 4, limitReached: true },
    ])
    expect((await cleanupAuthState(client.database, clock, { batchSize: 2, maxBatches: 2 })).results.map(row => row.deletedCount)).toEqual([1, 1])
  })
  it('成功审计失败回滚删除；失败审计可见，重试安全', async () => {
    await sessions([now])
    const fail = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture'))
    try { await expect(cleanupAuthState(client.database, clock)).rejects.toThrow() } finally { fail.mockRestore() }
    expect(await client.database.select().from(adminSessions)).toHaveLength(1)
    const [audit] = await client.database.select().from(adminOperationLogs)
    expect(audit?.result).toBe('failed')
    expect((await cleanupAuthState(client.database, clock)).results[0]!.deletedCount).toBe(1)
  })
  it('多实例只删除一次，活跃限流窗口续期不会被旧选择删除', async () => {
    await sessions(Array.from({ length: 9 }, () => now))
    await rates([rateCleanupCutoff(now)])
    const results = await Promise.all([
      cleanupAuthState(client.database, clock, { batchSize: 2 }),
      cleanupAuthState(client.database, clock, { batchSize: 2 }),
      client.database.transaction(tx => authRepository.consume(tx, 'fixture-0', now, new Date(now.getTime() - 600_000))),
    ])
    expect(results[0].results[0]!.deletedCount + results[1].results[0]!.deletedCount).toBe(9)
    const [row] = await client.database.select().from(adminRateLimits).where(eq(adminRateLimits.key, 'fixture-0'))
    expect(row?.windowStart).toEqual(now)
    expect(row?.hits).toBe(1)
  })
  it('非法批次在任何删除前拒绝，新增窗口索引已迁移', async () => {
    await sessions([now])
    for (const options of [{ batchSize: 0 }, { batchSize: 1001 }, { maxBatches: 21 }, { batchSize: 1.1 }]) await expect(cleanupAuthState(client.database, clock, options)).rejects.toThrow('INVALID_CLEANUP_BATCH')
    expect(await client.database.select().from(adminSessions)).toHaveLength(1)
    const [indexes] = await client.pool.query("SHOW INDEX FROM admin_rate_limits WHERE Key_name='admin_rate_limits_window'")
    expect(indexes).toHaveLength(1)
  })
})
