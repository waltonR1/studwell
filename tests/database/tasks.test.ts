import {setRolePermissions} from './authorization-fixture'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import { adminTasks, adminTaskRuns, adminTaskCommands, adminUsers, adminAuthLogs, adminOperationLogs, adminUserRoles } from '../../server/db/schema'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createRbacService } from '../../server/services/rbac'
import { createRoleService } from '../../server/services/roles'
import { createTaskService } from '../../server/services/tasks'
import { taskRepository as repo } from '../../server/repositories/tasks'
import { claimQueuedTask, enqueueTask, finishTask, lockExecution } from '../../server/services/tasks/state'
import { executeTask } from '../../server/services/tasks/executor'
import { auditRepository } from '../../server/repositories/audit'
import { buildTaskWorker } from '../../scripts/build-task-worker'
import { startTaskRunner } from '../../server/tasks/runner'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, reader: bigint, service: ReturnType<typeof createTaskService>
const meta = { ip: 'local', userAgent: 'task-fixture', requestId: randomUUID() }
const worker = resolve('.cache/test-task-worker.mjs')
beforeAll(async () => {
  client = await setupTestDatabase()
  root = BigInt((await seedRoot(client.database, 'Task fixture Aurora 8462!')).id)
  reader = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'task_fixture', displayName: 'Task fixture', password: 'Task fixture Aurora 8462!' }, String(root))).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  await createRbacService(client.database).sync()
  service = createTaskService(client.database, { executionAllowed: true })
  await buildTaskWorker(worker)
})
beforeEach(async () => {
  await client.database.update(adminTasks).set({ activeRunId: null, activeToken: null, ownerId: null, leaseUntil: null, enabled: true, version: 1, appliedVersion: 1, heartbeatAt: new Date(), pendingRetry: 0, pendingContinuation: 0, pendingGroupId: null })
  await client.database.update(adminTasks).set({ retention: { login: 180, audit: 730, security: 730 } }).where(eq(adminTasks.code, 'log_cleanup'))
  await client.database.delete(adminTaskCommands); await client.database.delete(adminTaskRuns); await client.database.delete(adminAuthLogs); await client.database.delete(adminOperationLogs)
})
afterAll(async () => { if (client) await cleanTestDatabase(client) })
async function queued(code = 'log_cleanup') {
  const row = (await repo.byCode(client.database, code))!
  return client.database.transaction(async tx => enqueueTask(tx, (await repo.task(tx, row.id, true))!, 'manual', root, new Date()))
}
async function running(code = 'log_cleanup') { const run = await queued(code); await claimQueuedTask(client.database, run.taskId, randomUUID()); return run }

describe('任务管理、执行隔离与真实数据库', () => {

  it('固定四任务，显式DTO不暴露私有令牌；旧参数权限不授予任务权限', async () => {
    expect((await service.list(root)).map(t => t.code)).toEqual(['log_cleanup', 'auth_cleanup', 'run_cleanup', 'search_rebuild'])
    await expect(service.list(reader)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const run = await running(); const result = await service.record(root, String(run.id))
    expect(result).not.toHaveProperty('token'); expect(JSON.stringify(await service.list(root))).not.toContain(run.token)
  })
  it('配置CAS、最小间隔、只读环境和单任务互斥', async () => {
    const row = (await service.list(root))[0]!
    await service.update(root, row.id, { version: 1, schedule: { mode: 'daily', time: '05:00' }, retention: row.retention }, meta)
    await expect(service.update(root, row.id, { version: 1, schedule: row.schedule, retention: row.retention }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
    const updated = (await service.list(root))[0]!
    await expect(createTaskService(client.database, { executionAllowed: false }).run(root, row.id, { version: 2, confirmed: true }, meta)).rejects.toMatchObject({ code: 'TASK_EXECUTION_DISABLED' })
    await service.run(root, row.id, { version: updated.version, confirmed: true }, meta)
    await expect(service.run(root, row.id, { version: updated.version, confirmed: true }, meta)).rejects.toMatchObject({ code: 'TASK_BUSY' })
  })
  it('删除、审计与执行进度同一事务；审计失败完整回滚', async () => {
    const run = await running()
    await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', { userId: root, username: 'root', action: 'login', result: 'success', ...meta, createdAt: new Date('2020-01-01Z') }))
    const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('fixture audit'))
    try { await executeTask(client.database, run.id, run.token, () => false) } finally { spy.mockRestore() }
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(1)
    expect(await repo.run(client.database, run.id)).toMatchObject({ status: 'failed', counts: [] })
  })
  it('真实构建的独立进程完成清理，计数与审计对应', async () => {
    const run = await running()
    await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', { userId: root, username: 'root', action: 'login', result: 'success', ...meta, createdAt: new Date('2020-01-01Z') }))
    const child = fork(worker, [], { execArgv: [], windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'], env: { ...process.env, STUDWELL_TASK_RUN_ID: String(run.id), STUDWELL_TASK_TOKEN: run.token, STUDWELL_TASK_DATABASE_URL: process.env.TEST_DATABASE_URL! } })
    let stderr = ''; child.stderr?.on('data', chunk => { stderr += String(chunk) })
    const [code] = await once(child, 'exit'); expect(code, stderr).toBe(0)
    expect(await repo.run(client.database, run.id)).toMatchObject({ status: 'success', counts: expect.arrayContaining([expect.objectContaining({ kind: 'login', deletedCount: 1 })]) })
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(0)
  })
  it('后续批次失败保留先前提交的1000条进度，失败批次删除回滚', async () => {
    const run = await running()
    await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', Array.from({ length: 1001 }, () => ({ userId: root, username: 'root', action: 'login', result: 'success', ...meta, createdAt: new Date('2020-01-01Z') }))))
    const original = auditRepository.audit, spy = vi.spyOn(auditRepository, 'audit')
    spy.mockImplementationOnce(original).mockRejectedValueOnce(new Error('second batch fixture'))
    try { await executeTask(client.database, run.id, run.token, () => false) } finally { spy.mockRestore() }
    expect(await client.database.select().from(adminAuthLogs)).toHaveLength(1)
    expect(await repo.run(client.database, run.id)).toMatchObject({ status: 'failed', counts: [expect.objectContaining({ kind: 'login', deletedCount: 1000, batches: 1 })] })
  })
  it('停止请求生效；已结束执行不可再次停止；旧令牌不能提交', async () => {
    const run = await running()
    await service.control(root, String(run.id), { action: 'stop', confirmed: true }, meta)
    await executeTask(client.database, run.id, run.token, () => false)
    expect(await repo.run(client.database, run.id)).toMatchObject({ status: 'stopped', counts: [] })
    await expect(service.control(root, String(run.id), { action: 'force', confirmed: true }, meta)).rejects.toMatchObject({ code: 'TASK_FINISHED' })
    await expect(client.database.transaction(tx => lockExecution(tx, run.id, run.token))).rejects.toThrow('LEASE_LOST')
  })
  it('worker看到强制终止请求也不得提前宣告终止，由父控制器退出确认后结束', async () => {
    const run = await running()
    await service.control(root, String(run.id), { action: 'force', confirmed: true }, meta)
    await executeTask(client.database, run.id, run.token, () => false)
    expect((await repo.run(client.database, run.id))?.status).toBe('running')
    await finishTask(client.database, run.id, run.token, 'failed', 'WORKER_EXIT')
    expect((await repo.run(client.database, run.id))?.status).toBe('terminated')
  })
  it('失败重试同组且最多两次，不无限重试', async () => {
    let run = await running()
    const group = run.groupId
    for (let attempt = 0; attempt <= 2; attempt++) {
      await finishTask(client.database, run.id, run.token, 'failed', 'EXECUTION_FAILED')
      const task = (await repo.task(client.database, run.taskId))!
      expect((await repo.run(client.database, run.id))?.retryAt === null).toBe(attempt === 2)
      if (attempt < 2) {
        run = await client.database.transaction(tx => enqueueTask(tx, task, 'retry', null, new Date()))
        await claimQueuedTask(client.database, task.id, randomUUID())
        expect(run.groupId).toBe(group); expect(run.attempt).toBe(attempt+1)
      }
    }
  })
  it('长事务持有任务和记录锁时强制控制信箱仍可提交；锁释放前不得确认终态', async () => {
    const run = await running(), connection = await client.pool.getConnection()
    await connection.beginTransaction()
    await connection.query('SELECT id FROM admin_tasks WHERE id=? FOR UPDATE', [String(run.taskId)])
    await connection.query('SELECT id FROM admin_task_runs WHERE id=? FOR UPDATE', [String(run.id)])
    try {
      await service.control(root, String(run.id), { action: 'force', confirmed: true }, meta)
      let finished = false
      const completion = finishTask(client.database, run.id, run.token, 'failed', 'WORKER_EXIT').then(() => { finished = true })
      await new Promise(resolveWait => setTimeout(resolveWait, 100))
      expect(finished).toBe(false); expect((await repo.run(client.database, run.id))?.status).toBe('running')
      await connection.rollback(); await completion
      expect(await repo.run(client.database, run.id)).toMatchObject({ status: 'terminated', reason: 'FORCE_STOPPED' })
    } finally { await connection.rollback(); connection.release() }
  })
  it('过期租约恢复有二次确认，活跃租约不被误回收', async () => {
    const run = await running()
    await finishTask(client.database, run.id, run.token, 'interrupted', 'OWNER_LOST', new Date(), true)
    expect((await repo.run(client.database, run.id))?.status).toBe('running')
    await client.database.update(adminTasks).set({ leaseUntil: new Date(Date.now()-1000) }).where(eq(adminTasks.id, run.taskId))
    await finishTask(client.database, run.id, run.token, 'interrupted', 'OWNER_LOST', new Date(), true)
    expect((await repo.run(client.database, run.id))?.status).toBe('interrupted')
  })
  it('并发抢占只成功一次；运行快照不随配置变化；主动停止不安排失败重试', async () => {
    const run = await queued()
    const claims = await Promise.all([claimQueuedTask(client.database, run.taskId, randomUUID()), claimQueuedTask(client.database, run.taskId, randomUUID())])
    expect(claims.filter(Boolean)).toHaveLength(1)
    await service.update(root, String(run.taskId), { version: 1, schedule: { mode: 'daily', time: '06:00' }, retention: { login: 1, audit: 1, security: 1 } }, meta)
    expect((await repo.run(client.database, run.id))?.snapshot.retention?.login).toBe(180)
    await service.control(root, String(run.id), { action: 'stop', confirmed: true }, meta)
    await finishTask(client.database, run.id, run.token, 'failed', 'WORKER_EXIT')
    expect((await repo.run(client.database, run.id))?.retryAt).toBeNull()
    expect((await repo.task(client.database, run.taskId))?.pendingTrigger).toBe('scheduled')
  })
  it('查看、配置、启停、执行、停止和强制终止权限互相隔离', async () => {
    const roles = createRoleService(client.database), role = await roles.create(root, { code: 'task_reader', name: 'Task reader', enabled: true }, meta)
    await setRolePermissions(client.database, root, role.id, { version: 1, permissions: ['system.tasks.read', 'system.tasks.stop'] }, meta)
    await client.database.insert(adminUserRoles).values({ userId: reader, roleId: BigInt(role.id) })
    try {
      const row = (await service.list(reader))[0]!, run = await running()
      await expect(service.update(reader, row.id, { version: 1, schedule: row.schedule, retention: row.retention }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(service.status(reader, row.id, { version: 1, enabled: false }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(service.run(reader, row.id, { version: 1, confirmed: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(service.control(reader, String(run.id), { action: 'force', confirmed: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await service.control(reader, String(run.id), { action: 'stop', confirmed: true }, meta)
    } finally { await client.database.delete(adminUserRoles).where(eq(adminUserRoles.userId, reader)) }
  })
  it('90天记录清理仅删除已结束旧记录，保留活跃、近期和待处理控制记录及操作审计', async () => {
    const old = await queued(); await finishTask(client.database, old.id, old.token, 'success', null)
    await client.database.update(adminTaskRuns).set({ finishedAt: new Date('2020-01-01Z') }).where(eq(adminTaskRuns.id, old.id))
    const recent = await queued(); await finishTask(client.database, recent.id, recent.token, 'success', null)
    const pending = await queued(); await finishTask(client.database, pending.id, pending.token, 'success', null)
    await client.database.update(adminTaskRuns).set({ finishedAt: new Date('2020-01-01Z') }).where(eq(adminTaskRuns.id, pending.id))
    await client.database.insert(adminTaskCommands).values(await withEntityIds(client.database, 'admin_task_commands', { runId: pending.id, token: pending.token, action: 'force', createdAt: new Date() }))
    const active = await running('auth_cleanup'), cleanup = await running('run_cleanup')
    await executeTask(client.database, cleanup.id, cleanup.token, () => false)
    expect(await repo.run(client.database, old.id)).toBeUndefined()
    for (const r of [recent, pending, active, cleanup]) expect(await repo.run(client.database, r.id)).toBeDefined()
    expect(await repo.run(client.database, cleanup.id)).toMatchObject({ status: 'success', counts: [expect.objectContaining({ deletedCount: 1 })] })
    expect((await client.database.select().from(adminOperationLogs)).some(r => r.action === 'task_runs.cleanup')).toBe(true)
  })
  it('控制器真正强杀独立进程，未提交删除和进度回滚，网站进程保持存活', async () => {
    await client.database.update(adminTasks).set({ enabled: false })
    await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', { userId: root, username: 'root', action: 'force_fixture', result: 'success', ...meta, createdAt: new Date('2020-01-01Z') }))
    const run = await queued(), webPid = process.pid
    const stop = startTaskRunner(() => client.database, () => process.env.TEST_DATABASE_URL!, resolve('tests/fixtures/blocked-task-worker.mjs'))
    async function until(check: () => Promise<boolean>) { const deadline = Date.now()+15000; while (!await check()) { if (Date.now()>deadline) throw new Error('fixture wait timed out'); await new Promise(done => setTimeout(done,100)) } }
    try {
      await until(async () => { const [rows] = await client.pool.query('SELECT IS_USED_LOCK(?) AS owner', [`BF11A-force-${run.id}`]); return (rows as Array<{owner: number | null}>)[0]?.owner != null })
      await service.control(root, String(run.id), { action: 'force', confirmed: true }, meta)
      await until(async () => (await repo.run(client.database, run.id))?.status === 'terminated')
      expect(await client.database.select().from(adminAuthLogs)).toHaveLength(1)
      expect((await repo.run(client.database, run.id))?.counts).toEqual([])
      expect(process.pid).toBe(webPid)
    } finally { await stop() }
  })
})
