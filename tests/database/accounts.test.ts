import {withEntityIds} from '../../server/db/allocate-entity-id'
// 仅显式 test:db 执行：核验专用库后迁移/清理本模块测试表，不接触开发库。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDatabaseClient } from '../../server/db/client'
import { adminUsers } from '../../server/db/schema'
import { accountRepository } from '../../server/repositories/accounts'
import {seedRoot} from '../../scripts/database/seed/system'
import {accountDto, createAccountService} from '../../server/services/accounts'
import { verifyPassword } from '../../server/services/accounts/password'

import { setupTestDatabase, cleanTestDatabase } from './support'
let client: ReturnType<typeof createDatabaseClient> | undefined
let rootId: string
let initialized = false
const password = 'Database fixture Stellar 9036!'

beforeAll(async () => {
  client = await setupTestDatabase()
  initialized = true
  await expect(seedRoot(client.database, 'short')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  const roots = await Promise.all([seedRoot(client.database, '123456'), seedRoot(client.database, '123456')])
  expect(roots.filter(root => root.created)).toHaveLength(1)
  expect(roots[0]!.id).toBe(roots[1]!.id)
  rootId = roots[0]!.id
})
afterAll(async () => {
  if (!client) return
  if (initialized) await cleanTestDatabase(client)
  else await client.pool.end()
})

describe('真实 MySQL 账号约束与服务', () => {
  it('空库迁移、重跑迁移及 UTC 会话正确', async () => {
    const [[zone]] = await client!.pool.query<import('mysql2').RowDataPacket[]>('SELECT @@session.time_zone AS zone')
    expect(zone!.zone).toBe('+00:00')
    const root = await accountRepository.findByUsername(client!.database, 'root')
    expect(typeof root!.id).toBe('bigint')
    expect(root!.mustChangePassword).toBe(true)
    expect(await verifyPassword(root!.passwordHash, '123456')).toBe(true)
    expect(Math.abs(Date.now() - root!.createdAt.getTime())).toBeLessThan(10000)
  })
  it('Seed 重跑和并发不重置密码或元数据', async () => {
    const before = await accountRepository.findByUsername(client!.database, 'root')
    const results = await Promise.all([seedRoot(client!.database), seedRoot(client!.database, 'ignored weak value')])
    expect(results.every(result => !result.created && result.id === rootId)).toBe(true)
    const after = await accountRepository.findByUsername(client!.database, 'root')
    expect(after).toEqual(before)
  })
  it('大小写规范化、唯一性、DTO 脱敏及不可改用户名', async () => {
    const service = createAccountService(client!.database)
    const user = await service.createOrdinary({ username: 'Alice_01', displayName: 'Alice', password }, rootId)
    expect(user.username).toBe('alice_01')
    expect(user).not.toHaveProperty('passwordHash')
    expect(user.createdBy).toBe(rootId)
    expect(() => JSON.stringify(user)).not.toThrow()
    await expect(service.createOrdinary({ username: 'ALICE_01', displayName: 'Duplicate', password }, rootId)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'DUPLICATE' })
    await expect(service.updateOrdinary(user.id, user.version, rootId, { username: 'renamed' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(client!.database.insert(adminUsers).values(await withEntityIds(client!.database, 'admin_users', { username: 'ALICE_02', displayName: 'raw', passwordHash: 'fixture' }))).rejects.toThrow()
  })
  it('Root 普通更新、重置、禁用和删除全部被拒绝', async () => {
    const service = createAccountService(client!.database)
    await expect(service.createOrdinary({ username: 'root', displayName: 'fake', password }, rootId)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.updateOrdinary(rootId, 1, rootId, { enabled: false })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.resetOrdinaryPassword(rootId, 1, rootId, password)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.softDeleteOrdinary(rootId, 1, rootId)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(client!.database.update(adminUsers).set({ enabled: false }).where(eq(adminUsers.id, BigInt(rootId)))).rejects.toThrow()
    await expect(client!.database.insert(adminUsers).values(await withEntityIds(client!.database, 'admin_users', { username: 'another_root', displayName: 'fake', passwordHash: 'fixture', isRoot: true }))).rejects.toThrow()
  })
  it('更新 version 冲突、重置要求改密、删除后用户名可复用但身份不复用', async () => {
    const service = createAccountService(client!.database)
    const user = await service.createOrdinary({ username: 'deleted_01', displayName: 'Delete', password }, rootId)
    await service.updateOrdinary(user.id, 1, rootId, { displayName: 'Updated' })
    await expect(service.updateOrdinary(user.id, 1, rootId, { displayName: 'Stale' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await service.resetOrdinaryPassword(user.id, 2, rootId, password + 'new')
    const reset = await accountRepository.findById(client!.database, BigInt(user.id))
    expect(reset!.mustChangePassword).toBe(true)
    expect(reset!.passwordHash).not.toContain(password)
    await service.softDeleteOrdinary(user.id, 3, rootId)
    const reused = await service.createOrdinary({ username: 'DELETED_01', displayName: 'Reuse', password }, rootId)
    expect(reused.id).not.toBe(user.id)
    expect((await accountRepository.findByUsername(client!.database, 'deleted_01'))!.id).toBe(BigInt(reused.id))
    expect((await accountRepository.findById(client!.database, BigInt(user.id)))!.deletedAt).not.toBeNull()
    await service.softDeleteOrdinary(reused.id, 1, rootId)
    const third = await service.createOrdinary({ username: 'deleted_01', displayName: 'Third', password }, rootId)
    expect(third.id).not.toBe(reused.id)
    const competing = await Promise.allSettled([service.createOrdinary({ username: 'reuse_race', displayName: 'First', password }, rootId), service.createOrdinary({ username: 'REUSE_RACE', displayName: 'Second', password }, rootId)])
    expect(competing.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    expect(competing.filter(item => item.status === 'rejected')).toHaveLength(1)
    await expect(service.updateOrdinary(user.id, 4, rootId, { enabled: true })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('同一事务中写入失败全部回滚', async () => {
    await expect(client!.database.transaction(async tx => {
      await accountRepository.insert(tx, { username: 'rollback_01', displayName: 'Rollback', passwordHash: 'fixture', createdBy: BigInt(rootId) })
      await accountRepository.insert(tx, { username: 'root', displayName: 'Conflict', passwordHash: 'fixture' })
    })).rejects.toThrow()
    expect(await accountRepository.findByUsername(client!.database, 'rollback_01')).toBeUndefined()
  })
  it('创建者外键拒绝不存在的账号', async () => {
    await expect(accountRepository.insert(client!.database, { username: 'invalid_actor', displayName: 'Invalid', passwordHash: 'fixture', createdBy: 18446744073709551615n })).rejects.toThrow()
  })
  it('超过 JavaScript 安全整数的 ID 往返不丢精度', async () => {
    await client!.database.insert(adminUsers).values(await withEntityIds(client!.database, 'admin_users', { username: 'high_precision', displayName: 'Precision', passwordHash: 'fixture' }))
    const row = await accountRepository.findByUsername(client!.database, 'high_precision')
    expect(row!.id).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER))
    expect(String(row!.id)).toMatch(/^\d{8}01\d{9}$/)
    const loaded = await accountRepository.findById(client!.database, BigInt(accountDto(row!).id))
    expect(loaded!.id).toBe(row!.id)
  })
})
