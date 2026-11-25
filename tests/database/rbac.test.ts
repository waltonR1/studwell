import {withEntityIds} from '../../server/db/allocate-entity-id'
// RBAC 真实 MySQL/HTTP 测试；fixture 权限与路由仅注入测试服务，不进入生产目录。
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { and, eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import { adminRoles, adminPermissions, adminRolePermissions, adminUserRoles, adminUsers } from '../../server/db/schema'
import { createRbacService } from '../../server/services/rbac'
import { permissionCatalog, adminRoutePolicies } from '../../server/config/permissions'
import { createAuthService, csrfToken } from '../../server/services/auth'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { guardAdminRequest, readSessionCookie, SESSION_COOKIE } from '../../server/http/auth'
import {ApiError} from '../../server/core/errors'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse, defineApiHandler } from '../../server/http/handler'

const catalog = [...permissionCatalog, {code: 'fixture.reserved', name: '测试预留', available: false}, { code: 'fixture.read', name: '测试读取', available: true }, { code: 'fixture.write', name: '测试写入', available: true }]
const policies = [...adminRoutePolicies,
  { method: 'GET', path: '/api/admin/fixture/read', permission: 'fixture.read', enabled: true },
  { method: 'POST', path: '/api/admin/fixture/write', permission: 'fixture.write', enabled: true },
  { method: 'GET', path: '/api/admin/fixture/disabled', permission: 'fixture.read', enabled: false },
  { method: 'GET', path: '/api/admin/fixture/reserved', permission: 'fixture.reserved', enabled: true },
]
let client: Awaited<ReturnType<typeof setupTestDatabase>>, server: Server, base: string
let rbac: ReturnType<typeof createRbacService>, auth: ReturnType<typeof createAuthService>
let root: bigint, user: bigint, first: bigint, second: bigint, read: bigint, write: bigint
const password = 'RBAC fixture Aurora 28479!'
const meta = { ip: '127.0.0.1', userAgent: 'rbac-fixture', requestId: '00000000-0000-4000-8000-000000000001' }
beforeAll(async () => {
  client = await setupTestDatabase()
  root = BigInt((await seedRoot(client.database, password)).id)
  const created = await createAccountService(client.database, false).createOrdinary({ username: 'rbac_member', displayName: 'Member', password }, String(root))
  user = BigInt(created.id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  auth = createAuthService(client.database, undefined, false)
  rbac = createRbacService(client.database, catalog, policies)
  await rbac.sync()
  await client.database.insert(adminRoles).values(await withEntityIds(client.database, 'admin_roles', [{ code: 'fixture_first', name: 'First' }, { code: 'fixture_second', name: 'Second' }]))
  const roles = await client.database.select().from(adminRoles)
  first = roles.find(row => row.code === 'fixture_first')!.id
  second = roles.find(row => row.code === 'fixture_second')!.id
  const permissions = await client.database.select().from(adminPermissions)
  read = permissions.find(row => row.code === 'fixture.read')!.id
  write = permissions.find(row => row.code === 'fixture.write')!.id
  const app = createApp(), router = createRouter()
  app.use(defineEventHandler(async event => {
    ensureRequestId(event)
    try { await guardAdminRequest(event, auth, { origin: 'http://rbac.test', secureCookie: false }, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) }
  }))
  for (const path of ['read', 'disabled', 'reserved', 'unknown']) router.get(`/api/admin/fixture/${path}`, defineApiHandler(() => ({ ok: true })))
  router.post('/api/admin/fixture/write', defineApiHandler(() => ({ ok: true })))
  router.get('/api/admin/auth/permissions', defineApiHandler(async event => {
    const current = await auth.resolve(readSessionCookie(event))
    if (!current?.user) throw new ApiError('UNAUTHENTICATED')
    return rbac.snapshot(current.user.id)
  }))
  app.use(router)
  server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()))
  if (client) await cleanTestDatabase(client)
})
async function login(username: string) {
  const anon = await auth.bootstrap(undefined, meta)
  return (await auth.login(anon.raw, username, password, meta)).raw
}
async function request(raw: string, path: string, method = 'GET', csrf = true) {
  return fetch(base + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${raw}`, ...(method === 'POST' ? { Origin: 'http://rbac.test', 'X-CSRF-Token': csrf ? csrfToken(raw) : 'bad' } : {}) } })
}

describe('RBAC 基础', () => {
  it('空库初始化不预设普通角色，Root 不依赖角色关联', async () => {
    const rows = await client.database.select().from(adminRoles)
    expect(rows.map(row => row.code).sort()).toEqual(['fixture_first', 'fixture_second'])
    expect(await client.database.select().from(adminUserRoles)).toEqual([])
    expect((await rbac.snapshot(root)).isRoot).toBe(true)
  })
  it('无角色可读本人空权限，不泄露角色/其他账号', async () => {
    const snapshot = await rbac.snapshot(user)
    expect(snapshot.permissions).toEqual(['account.permissions.read'])
    expect(snapshot.isRoot).toBe(false)
    expect(snapshot).not.toHaveProperty('roles')
    const raw = await login('rbac_member')
    expect((await request(raw, '/api/admin/auth/permissions')).status).toBe(200)
    const own = await request(raw, `/api/admin/auth/permissions?userId=${root}`)
    expect((await own.json()).data.isRoot).toBe(false)
    expect((await fetch(base + '/api/admin/fixture/read')).status).toBe(401)
    expect((await request(raw, '/api/admin/fixture/read')).status).toBe(403)
  })
  it('多角色取并集，重复授权去重；撤权下一次 HTTP 请求生效', async () => {
    await client.database.insert(adminUserRoles).values([{ userId: user, roleId: first }, { userId: user, roleId: second }])
    await client.database.insert(adminRolePermissions).values([{ roleId: first, permissionId: read }, { roleId: second, permissionId: read }, { roleId: second, permissionId: write }])
    const raw = await login('rbac_member'), before = await rbac.snapshot(user)
    expect(before.permissions).toEqual(['account.permissions.read', 'fixture.read', 'fixture.write'])
    expect((await request(raw, '/api/admin/fixture/read')).status).toBe(200)
    expect((await request(raw, '/api/admin/fixture/write', 'POST', false)).status).toBe(403)
    expect((await request(raw, '/api/admin/fixture/write', 'POST')).status).toBe(200)
    await client.database.delete(adminRolePermissions).where(eq(adminRolePermissions.permissionId, read))
    expect((await request(raw, '/api/admin/fixture/read')).status).toBe(403)
    expect((await rbac.snapshot(user)).version).not.toBe(before.version)
    await client.database.update(adminRoles).set({ enabled: false }).where(eq(adminRoles.id, second))
    expect((await request(raw, '/api/admin/fixture/write', 'POST')).status).toBe(403)
  })
  it('Seed 重跑保留授权、角色配置；废弃目录禁用，新增权限不自动授予', async () => {
    await client.database.insert(adminRoles).values(await withEntityIds(client.database, 'admin_roles', { code: 'administrator', name: 'Custom name', enabled: false }))
    const before = await client.database.select().from(adminRolePermissions)
    await rbac.sync(); await rbac.sync()
    expect(await client.database.select().from(adminRolePermissions)).toEqual(before)
    const [basic] = await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'administrator'))
    expect(basic).toMatchObject({ name: 'Custom name', enabled: false })
    await client.database.delete(adminRoles).where(eq(adminRoles.id, basic!.id))
    await rbac.sync()
    expect(await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'administrator'))).toEqual([])
    const changed = createRbacService(client.database, [...catalog.filter(row => row.code !== 'fixture.write'), { code: 'fixture.new', name: 'New', available: true }], [])
    await changed.sync()
    const [old] = await client.database.select().from(adminPermissions).where(eq(adminPermissions.code, 'fixture.write'))
    expect(old!.available).toBe(false)
    expect((await changed.snapshot(user)).permissions).not.toContain('fixture.new')
    await rbac.sync()
  })
  it('Root 不依赖角色，但不能绕过禁用、预留、未知方法或未登记路由', async () => {
    const raw = await login('root')
    expect((await request(raw, '/api/admin/fixture/read')).status).toBe(200)
    for (const path of ['disabled', 'reserved', 'unknown']) expect((await request(raw, `/api/admin/fixture/${path}`)).status).toBe(403)
    expect((await request(raw, '/api/admin/fixture/read', 'POST')).status).toBe(403)
    expect((await rbac.snapshot(root)).permissions).not.toContain('fixture.reserved')
    expect((await rbac.snapshot(user)).isRoot).toBe(false)
  })
  it('代码目录再次过滤伪造可用权限；首次改密与禁用账号仍被阻止', async () => {
    const [reserved] = await client.database.select().from(adminPermissions).where(eq(adminPermissions.code, 'fixture.reserved'))
    await client.database.update(adminPermissions).set({ available: true }).where(eq(adminPermissions.id, reserved!.id))
    await client.database.update(adminRoles).set({ enabled: true }).where(eq(adminRoles.id, first))
    await client.database.insert(adminRolePermissions).values({ roleId: first, permissionId: reserved!.id })
    expect((await rbac.snapshot(user)).permissions).not.toContain('fixture.reserved')
    await client.database.update(adminUsers).set({ mustChangePassword: true }).where(eq(adminUsers.id, user))
    await expect(rbac.snapshot(user)).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' })
    await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: false }).where(eq(adminUsers.id, user))
    await expect(rbac.snapshot(user)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    await client.database.update(adminUsers).set({ enabled: true }).where(eq(adminUsers.id, user))
  })
  it('关联唯一/外键约束与事务回滚，不允许悬空或重复授权', async () => {
    await expect(client.database.insert(adminUserRoles).values({ userId: user, roleId: first })).rejects.toThrow()
    await expect(client.database.insert(adminUserRoles).values({ userId: 18446744073709551615n, roleId: first })).rejects.toThrow()
    await expect(client.database.delete(adminRoles).where(eq(adminRoles.id, first))).rejects.toThrow()
    await expect(client.database.transaction(async tx => {
      await tx.delete(adminUserRoles).where(and(eq(adminUserRoles.userId, user), eq(adminUserRoles.roleId, second)))
      await tx.insert(adminUserRoles).values({ userId: user, roleId: first })
    })).rejects.toThrow()
    const rows = await client.database.select().from(adminUserRoles).where(and(eq(adminUserRoles.userId, user), eq(adminUserRoles.roleId, second)))
    expect(rows).toHaveLength(1)
  })
  it('生产目录开放正式新闻权限但不开放 fixture，重复配置会关闭授权', () => {
    expect(permissionCatalog.every(row => !row.code.startsWith('fixture.'))).toBe(true)
    expect(permissionCatalog.filter(row=>row.code.startsWith('content.news.')).every(row=>row.available)).toBe(true)
    expect(permissionCatalog.some(row=>row.code==='content.news.publish')).toBe(true)
    expect(adminRoutePolicies.some(policy => policy.path === '/api/admin/roles')).toBe(true)
    expect(() => createRbacService(client.database, [...catalog, catalog[0]!])).toThrow()
    expect(() => createRbacService(client.database, catalog, [...policies, policies[0]!])).toThrow()
    expect(() => createRbacService(client.database, catalog, [{ method: 'GET', path: '/api/admin/fixture/read', permission: 'fixture.read', enabled: true, self: true }])).toThrow()
  })
})
