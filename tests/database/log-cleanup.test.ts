import {logRetentionCutoff} from '../../server/policies/cleanup'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import { adminAuthLogs, adminOperationLogs, adminTasks, adminUsers } from '../../server/db/schema'
import { cleanupLogs } from '../../server/services/cleanup/log-cleanup'
import { resolveLogRetention } from '../../server/services/parameter-values'
import { auditRepository } from '../../server/repositories/audit'
import { createLogService } from '../../server/services/logs'
import {seedRoot} from '../../scripts/database/seed/system'

let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint
const now = new Date('2026-10-26T04:00:00Z'), clock = () => now
const meta = { ip: 'local', userAgent: 'cleanup-fixture', requestId: '00000000-0000-4000-8000-000000000001' }
beforeAll(async () => {
  client = await setupTestDatabase()
  root = BigInt((await seedRoot(client.database, 'Cleanup fixture Stellar 831!')).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
})
beforeEach(async () => {
  await client.database.delete(adminAuthLogs); await client.database.delete(adminOperationLogs)
  await client.database.update(adminTasks).set({ enabled: true, retention: { login: 180, audit: 730, security: 730 } }).where(eq(adminTasks.code, 'log_cleanup'))
})
afterAll(async () => { if (client) await cleanTestDatabase(client) })
async function authRows(action: string, times: Date[]) {
  await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', times.map(createdAt => ({ ...meta, userId: root, username: 'root', action, result: 'success', createdAt }))))
}
describe('日志保留任务真实数据库', () => {
  it('三类独立截止时间，严格小于边界；不清理未归类认证事件，审计上下文可查看导出', async () => {
    for (const [days, action] of [[180, 'login'], [730, 'csrf']] as const) {
      const cutoff = logRetentionCutoff(now, days)
      await authRows(action, [new Date(cutoff.getTime() - 1), cutoff, now])
    }
    const cutoff = logRetentionCutoff(now, 730)
    await client.database.insert(adminOperationLogs).values(await withEntityIds(client.database, 'admin_operation_logs', [new Date(cutoff.getTime() - 1), cutoff, now].map(createdAt => ({ ...meta, actorId: root, action: 'users.update', targetType: 'user', result: 'success', createdAt }))))
    await authRows('future_unknown_event', [new Date('2020-01-01T00:00:00Z')])
    const result = await cleanupLogs(client.database, clock)
    expect(result.results.map(row => row.deletedCount)).toEqual([1, 1, 1])
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(5)
    expect(await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.action, 'users.update'))).toHaveLength(2)
    const logs = createLogService(client.database, clock)
    const page = await logs.list(root, 'audit', { period: 'today', action: 'logs.cleanup' })
    expect(page.total).toBe(3)
    expect(page.items.every(row => row.actorId === null && row.cleanupContext?.deletedCount === 1)).toBe(true)
    const csv = await logs.export(root, 'audit', { period: 'today', action: 'logs.cleanup' }, meta)
    expect(csv.csv).toContain('清理信息'); expect(csv.csv).toContain('retentionDays')
  })
  it('关闭时不清理不写假成功，非法任务配置拒绝执行', async () => {
    await authRows('login', [new Date('2020-01-01T00:00:00Z')])
    await client.database.update(adminTasks).set({ enabled: false }).where(eq(adminTasks.code, 'log_cleanup'))
    expect(await cleanupLogs(client.database, clock)).toEqual({ enabled: false, results: [] })
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(1)
    expect(await client.database.select().from(adminOperationLogs)).toHaveLength(0)
    await client.database.update(adminTasks).set({ enabled: true }).where(eq(adminTasks.code, 'log_cleanup'))
    await client.database.update(adminTasks).set({ retention: { login: 0, audit: 730, security: 730 } }).where(eq(adminTasks.code, 'log_cleanup'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { await expect(resolveLogRetention(client.database)).rejects.toThrow() } finally { warn.mockRestore() }
  })
  it('数据库策略生效，批次上限限制本轮工作，下一轮继续且不会重复计数', async () => {
    await client.database.update(adminTasks).set({ retention: { login: 1, audit: 730, security: 730 } }).where(eq(adminTasks.code, 'log_cleanup'))
    await authRows('login', Array.from({ length: 5 }, () => new Date(now.getTime() - 2 * 86400_000)))
    const first = await cleanupLogs(client.database, clock, { batchSize: 2, maxBatches: 2 })
    expect(first.results[0]).toEqual({ kind: 'login', deletedCount: 4, limitReached: true })
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(1)
    const next = await cleanupLogs(client.database, clock, { batchSize: 2, maxBatches: 2 })
    expect(next.results[0]!.deletedCount).toBe(1)
    const batches = await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.action, 'logs.cleanup'))
    expect(batches.filter(row => row.cleanupContext?.kind === 'login').reduce((sum, row) => sum + row.cleanupContext!.deletedCount, 0)).toBe(5)
  })
  it('成功审计失败回滚删除，失败上下文计零，再执行可安全重试', async () => {
    await authRows('login', [new Date('2020-01-01T00:00:00Z')])
    const fail = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture failure'))
    try { await expect(cleanupLogs(client.database, clock)).rejects.toThrow() } finally { fail.mockRestore() }
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(1)
    const [failure] = await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.result, 'failed'))
    expect(failure?.cleanupContext?.deletedCount).toBe(0)
    expect((await cleanupLogs(client.database, clock)).results[0]!.deletedCount).toBe(1)
  })
  it('两个实例并发分批清理不重复删除或审计计数', async () => {
    await authRows('login', Array.from({ length: 9 }, () => new Date('2020-01-01T00:00:00Z')))
    const results = await Promise.all([cleanupLogs(client.database, clock, { batchSize: 2, maxBatches: 10 }), cleanupLogs(client.database, clock, { batchSize: 2, maxBatches: 10 })])
    expect(results.reduce((sum, result) => sum + result.results[0]!.deletedCount, 0)).toBe(9)
    const records = await client.database.select().from(adminOperationLogs).where(and(eq(adminOperationLogs.action, 'logs.cleanup'), eq(adminOperationLogs.result, 'success')))
    expect(records.filter(row => row.cleanupContext?.kind === 'login').reduce((sum, row) => sum + row.cleanupContext!.deletedCount, 0)).toBe(9)
  })
})
