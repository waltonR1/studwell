import {setRolePermissions} from './authorization-fixture'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {parameterSeedDefaults} from '../../scripts/database/seed/system'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createParameterService } from '../../server/services/parameters'
import { createAuthService, tokenHash } from '../../server/services/auth'
import { createRbacService } from '../../server/services/rbac'
import { createRoleService } from '../../server/services/roles'
import { parameterRepository } from '../../server/repositories/parameters'
import { auditRepository } from '../../server/repositories/audit'
import { authRepository } from '../../server/repositories/auth'
import { adminUsers, adminUserRoles, adminParameters } from '../../server/db/schema'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, writer: bigint, parameters: ReturnType<typeof createParameterService>
const password = 'Policy fixture Aurora 8420!', meta = { ip: '127.0.0.1', userAgent: 'policy-fixture', requestId: '00000000-0000-4000-8000-000000000001' }
async function changes(values: Record<string, number | boolean | null>, actor = root) {
  const rows = await parameters.list(root)
  return parameters.batch(actor, { items: Object.entries(values).map(([key, value]) => { const row = rows.find(row => row.key === key)!; return { id: row.id, version: row.version, value } }) }, meta)
}
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  const user = await createAccountService(client.database, false).createOrdinary({ username: 'policy_writer', displayName: 'Writer', password }, String(root)); writer = BigInt(user.id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  await createRbacService(client.database).sync(); parameters = createParameterService(client.database)
  const roles = createRoleService(client.database), role = await roles.create(root, { code: 'policy_writer_role', name: 'Writer', enabled: true }, meta)
  await setRolePermissions(client.database, root, role.id, { version: 1, permissions: ['system.parameters.read', 'system.parameters.update'] }, meta)
  await client.database.insert(adminUserRoles).values({ userId: writer, roleId: BigInt(role.id) })
})
afterAll(async () => { if (client) await cleanTestDatabase(client) })
describe('数据库参数与安全策略', () => {
  it('28项初始化，弱口令检查默认开启', async () => {
    const rows = await parameters.list(root)
    expect(Object.fromEntries(rows.map(row => [row.key, row.defaultValue]))).toEqual(parameterSeedDefaults)
    expect((await parameters.list(root)).find(row => row.key === 'security.password.blocklistEnabled')?.value).toBe(true)
  })
  it('普通参数写权限不包含安全策略，普通值可独立更新', async () => {
    await expect(changes({ 'security.session.idleSeconds': 60 }, writer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await changes({ 'admin.list.defaultPageSize': 50 }, writer)
    await changes({ 'admin.list.defaultPageSize': null })
  })
  it('密码关联值原子校验；严格策略只约束新设置的密码', async () => {
    await expect(changes({ 'security.password.minLength': 64, 'security.password.maxLength': 32 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await parameters.list(root)).find(row => row.key === 'security.password.minLength')?.value).toBe(6)
    await changes({ 'security.password.minLength': 32, 'security.password.maxLength': 64 })
    try {
      await expect(createAccountService(client.database).createOrdinary({ username: 'short_policy', displayName: 'Short', password: '123456' }, String(root))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
      const auth = createAuthService(client.database), anonymous = await auth.bootstrap(undefined, meta)
      expect((await auth.login(anonymous.raw, 'root', password, meta)).raw).toBeTruthy()
      await createAccountService(client.database).createOrdinary({ username: 'valid_policy', displayName: 'Valid', password: 'A'.repeat(40) }, String(root))
    } finally { await changes({ 'security.password.minLength': null, 'security.password.maxLength': null }) }
  })
  it('会话策略快照只影响新会话，已有会话不被缩短', async () => {
    let now = new Date('2026-10-26T00:00:00Z')
    const auth = createAuthService(client.database, () => now), anonymous = await auth.bootstrap(undefined, meta), previous = await auth.login(anonymous.raw, 'root', password, meta)
    await changes({ 'security.session.idleSeconds': 60, 'security.session.absoluteSeconds': 300, 'security.session.anonymousSeconds': 60 })
    try {
      const next = await auth.login((await auth.bootstrap(undefined, meta)).raw, 'root', password, meta)
      expect((await authRepository.session(client.database, tokenHash(next.raw)))?.idleTimeoutMs).toBe(60000)
      now = new Date(now.getTime() + 61000)
      expect(await auth.resolve(next.raw)).toBeNull(); expect(await auth.resolve(previous.raw)).not.toBeNull()
    } finally { await changes({ 'security.session.idleSeconds': null, 'security.session.absoluteSeconds': null, 'security.session.anonymousSeconds': null }) }
  })
  it('阈值调整使用新计数，不能禁用限流', async () => {
    const auth = createAuthService(client.database)
    await changes({ 'security.rate.login-account.count': 2, 'security.rate.login-account.windowSeconds': 60 })
    try {
      await auth.limit('login-account', 'policy_probe', meta); await auth.limit('login-account', 'policy_probe', meta)
      await expect(auth.limit('login-account', 'policy_probe', meta)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
      await changes({ 'security.rate.login-account.count': 3 })
      for (let i = 0; i < 3; i++) await auth.limit('login-account', 'policy_probe', meta)
      await expect(auth.limit('login-account', 'policy_probe', meta)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
      await expect(changes({ 'security.rate.login-account.count': 0 })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    } finally { await changes({ 'security.rate.login-account.count': null, 'security.rate.login-account.windowSeconds': null }) }
  })
  it('批量过期版本与审计失败都回滚整组；非法布尔覆盖不隐式转换', async () => {
    const rows = await parameters.list(root), group = rows.filter(row => row.group === 'password'), before = group.map(row => ({ key: row.key, value: row.value, version: row.version }))
    await expect(parameters.batch(root, { items: group.map((row, index) => ({ id: row.id, version: row.version + (index === 1 ? 1 : 0), value: null })) }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
    const audit = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture failure'))
    try { await expect(changes({ 'security.password.minLength': 8, 'security.password.maxLength': 64 })).rejects.toThrow('audit fixture failure') } finally { audit.mockRestore() }
    expect((await parameters.list(root)).filter(row => row.group === 'password').map(row => ({ key: row.key, value: row.value, version: row.version }))).toEqual(before)
    const row = await parameterRepository.find(client.database, 'security.password.blocklistEnabled')
    await client.database.update(adminParameters).set({ value: '"false"' }).where(eq(adminParameters.id, row!.id))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { expect((await parameters.list(root)).find(item => item.id === String(row!.id))).toMatchObject({ value: true, invalidOverride: true }) } finally { warn.mockRestore(); await changes({ 'security.password.blocklistEnabled': null }) }
  })
  it('关联策略被破坏时禁止部分修复掩盖问题，整组恢复后重新有效', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await client.database.update(adminParameters).set({ value: '128' }).where(eq(adminParameters.key, 'security.password.minLength'))
      await client.database.update(adminParameters).set({ value: '6' }).where(eq(adminParameters.key, 'security.password.maxLength'))
      const row = (await parameters.list(root)).find(item => item.key === 'security.password.minLength')!
      expect(row).toMatchObject({ value: 6, invalidOverride: true })
      await expect(parameters.update(root, row.id, { version: row.version, value: null }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
      await changes({ 'security.password.minLength': null, 'security.password.maxLength': null, 'security.password.blocklistEnabled': null })
      expect((await parameters.list(root)).filter(item => item.group === 'password').every(item => !item.invalidOverride)).toBe(true)
    } finally { warn.mockRestore() }
  })

})
