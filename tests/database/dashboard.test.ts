import {setRolePermissions, setRoleMenus} from './authorization-fixture'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createRoleService } from '../../server/services/roles'
import { createMenuService } from '../../server/services/menus'
import { createRbacService } from '../../server/services/rbac'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { createDashboardService } from '../../server/services/dashboard'
import { dashboardRepository } from '../../server/repositories/dashboard'
import { dashboardHandlers } from '../../server/http/handlers/dashboard-handlers'
import { adminUsers, adminRoles, adminUserRoles, adminDictionaries, adminAuthLogs, adminOperationLogs } from '../../server/db/schema'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
import { permissionCatalog } from '../../server/config/permissions'
import { dashboardMetricLink } from '../../app/utils/admin/dashboard/links'
import { dashboardMetrics } from '../../app/config/admin/dashboard'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, member: bigint, dashboardOnly: bigint, empty: bigint, disabled: bigint, deleted: bigint, partialRole: string, server: Server, base: string, raw: string, memberRaw: string
let service: ReturnType<typeof createDashboardService>
const password = 'Dashboard fixture Aurora 58321!', now = new Date('2026-10-22T04:00:00Z'), meta = { ip: '127.0.0.1', userAgent: 'dashboard-fixture', requestId: '00000000-0000-4000-8000-000000000001' }, options = { origin: 'http://dashboard.test', secureCookie: false }
async function request(path = 'dashboard', method = 'GET', body?: object, token = raw) { return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'X-CSRF-Token': csrfToken(token), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  const accounts = createAccountService(client.database, false), roles = createRoleService(client.database), rbac = createRbacService(client.database); await rbac.sync()
  const users: bigint[] = []
  for (const code of ['dashboard_member', 'dashboard_only', 'dashboard_empty', 'dashboard_disabled', 'dashboard_deleted']) users.push(BigInt((await accounts.createOrdinary({ username: code, displayName: code, password }, String(root))).id))
  ;[member, dashboardOnly, empty, disabled, deleted] = users as [bigint, bigint, bigint, bigint, bigint]
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  await client.database.update(adminUsers).set({ enabled: false }).where(eq(adminUsers.id, disabled))
  await client.database.update(adminUsers).set({ deletedAt: now }).where(eq(adminUsers.id, deleted))
  partialRole = (await roles.create(root, { code: 'dashboard_partial_role', name: 'Partial', enabled: true }, meta)).id
  await setRolePermissions(client.database, root, partialRole, { version: 1, permissions: ['system.dashboard.read', 'system.users.read', 'system.logs.login.read'] }, meta)
  const only = await roles.create(root, { code: 'dashboard_only_role', name: 'Only', enabled: true }, meta)
  await setRolePermissions(client.database, root, only.id, { version: 1, permissions: ['system.dashboard.read'] }, meta)
  await roles.create(root, { code: 'dashboard_disabled_role', name: 'Disabled', enabled: false }, meta)
  await client.database.insert(adminUserRoles).values([{ userId: member, roleId: BigInt(partialRole) }, { userId: dashboardOnly, roleId: BigInt(only.id) }])
  await client.database.insert(adminDictionaries).values(await withEntityIds(client.database, 'admin_dictionaries', [{ code: 'dashboard_enabled_dictionary', name: 'Enabled' }, { code: 'dashboard_disabled_dictionary', name: 'Disabled', enabled: false }]))
  const auth = createAuthService(client.database, undefined, false)
  async function login(username: string) { const anonymous = await auth.bootstrap(undefined, meta); return (await auth.login(anonymous.raw, username, password, meta)).raw }
  raw = await login('root'); memberRaw = await login('dashboard_member')
  // 仅清理本专用库的日志夹具，随后构造精确午夜边界，避免初始化操作污染计数。
  await client.pool.query('DELETE FROM admin_auth_logs'); await client.pool.query('DELETE FROM admin_operation_logs')
  const common = { ...meta, userId: root, username: 'dashboard_fixture', result: 'success' }, start = new Date('2026-10-21T16:00:00Z'), end = new Date('2026-10-22T16:00:00Z'), old = new Date(start.getTime() - 1)
  await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', [
    { ...common, action: 'login', createdAt: start }, { ...common, action: 'login', createdAt: now }, { ...common, action: 'login', result: 'failed', createdAt: now },
    { ...common, action: 'logout', createdAt: now }, { ...common, action: 'login', createdAt: old }, { ...common, action: 'login', createdAt: end },
    { ...common, action: 'csrf', result: 'denied', createdAt: start }, { ...common, action: 'password_change', createdAt: now }, { ...common, action: 'rbac_sync', createdAt: now }, { ...common, action: 'future_security_event', createdAt: now }, { ...common, action: 'csrf', createdAt: old },
  ]))
  const audit = { ...meta, actorId: root, action: 'users.update', targetType: 'user', result: 'success' }
  await client.database.insert(adminOperationLogs).values(await withEntityIds(client.database, 'admin_operation_logs', [{ ...audit, createdAt: start }, { ...audit, result: 'failed', createdAt: now }, { ...audit, action: 'logs.export', createdAt: now }, { ...audit, createdAt: old }, { ...audit, createdAt: end }]))
  service = createDashboardService(client.database, () => now)
  const app = createApp(), router = createRouter(), handler = dashboardHandlers(client.database, () => now)
  app.use(defineEventHandler(async event => { ensureRequestId(event); try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) } }))
  router.get('/api/admin/dashboard', handler.overview); app.use(router)
  server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('基础Dashboard纵向交付', () => {
  it('真实数量口径、北京时间午夜及未知安全事件，不统计退出为成功登录', async () => {
    const result = await service.overview(root)
    expect(result.stats).toEqual({ users: 5, roles: 3, dictionaries: 4, loginSuccess: 2, loginFailed: 1, auditToday: 3, securityToday: 4 })
    expect(result.range).toEqual({ start: '2026-10-21T16:00:00.000Z', endExclusive: '2026-10-22T16:00:00.000Z' }); expect(result.updatedAt).toBe(now.toISOString())
    expect(JSON.stringify(result)).not.toContain(password); expect(JSON.stringify(result)).not.toContain('127.0.0.1'); expect(JSON.stringify(result)).not.toContain('dashboard_fixture')
  })
  it('未授权项不查询、不返回，不以0代替；仅Dashboard权限返回空统计', async () => {
    const spy = vi.spyOn(dashboardRepository, 'count')
    try {
      expect((await service.overview(member)).stats).toEqual({ users: 5, loginSuccess: 2, loginFailed: 1 })
      expect(spy.mock.calls.map(call => call[1])).toEqual(['users', 'loginSuccess', 'loginFailed'])
      spy.mockClear(); expect((await service.overview(dashboardOnly)).stats).toEqual({}); expect(spy).not.toHaveBeenCalled()
      await expect(service.overview(empty)).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect(spy).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
  })
  it('各计数读取同一快照，下一请求反映新增数据', async () => {
    const original = dashboardRepository.count.bind(dashboardRepository), spy = vi.spyOn(dashboardRepository, 'count'); let inserted = false
    spy.mockImplementation(async (db, key, range) => { const result = await original(db, key, range); if (key === 'users' && !inserted) { inserted = true; await client.database.insert(adminRoles).values(await withEntityIds(client.database, 'admin_roles', { code: 'dashboard_snapshot_role', name: 'Snapshot' })) } return result })
    try { expect((await service.overview(root)).stats.roles).toBe(3) } finally { spy.mockRestore() }
    expect((await service.overview(root)).stats.roles).toBe(4)
    await client.database.delete(adminRoles).where(eq(adminRoles.code, 'dashboard_snapshot_role'))
  })
  it('菜单隐藏不改变业务统计，但不能从首页入口/卡片恢复隐藏链接', async () => {
    const menus = createMenuService(client.database), row = (await menus.list(root)).find(item => item.pageKey === 'users')!
    await setRoleMenus(client.database, root, partialRole, { version: 2, menuIds: [row.id] }, meta)
    expect((await menus.navigation(member)).items.some(item => item.path === '/admin/users')).toBe(true)
    await menus.update(root, row.id, { iconKey: row.iconKey, parentId: row.parentId, name: row.name, visible: false, sortOrder: row.sortOrder, version: row.version }, meta)
    try {
      const navigation = await menus.navigation(member); expect(navigation.items).toEqual([])
      expect((await service.overview(member)).stats.users).toBe(5)
      expect(dashboardMetricLink(dashboardMetrics[0]!, navigation.items)).toBeUndefined()
      expect((await menus.navigation(root)).items.some(item => item.path === '/admin/users')).toBe(false)
    } finally { await menus.update(root, row.id, { iconKey: row.iconKey, parentId: row.parentId, name: row.name, visible: true, sortOrder: row.sortOrder, version: row.version + 1 }, meta) }
  })
  it('Root不能绕过代码禁用的统计入口或模块权限', async () => {
    const module = permissionCatalog.find(item => item.code === 'system.users.read')!, entry = permissionCatalog.find(item => item.code === 'system.dashboard.read')!
    module.available = false
    try { expect((await service.overview(root)).stats).not.toHaveProperty('users') } finally { module.available = true }
    entry.available = false
    try { await expect(service.overview(root)).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect((await request()).status).toBe(403) } finally { entry.available = true }
  })
  it('查询失败明确失败，不返回伪造0或内部数据库错误', async () => {
    const spy = vi.spyOn(dashboardRepository, 'count').mockRejectedValueOnce(new Error('private database failure'))
    try { await expect(service.overview(root)).rejects.toThrow('private database failure') } finally { spy.mockRestore() }
    const httpSpy = vi.spyOn(dashboardRepository, 'count').mockRejectedValueOnce(new Error('private database failure'))
    try { const response = await request(); expect(response.status).toBe(500); const body = await response.text(); expect(body).toContain('INTERNAL_ERROR'); expect(body).not.toContain('private database failure'); expect(body).not.toContain('"stats"') } finally { httpSpy.mockRestore() }
  })
  it('真实HTTP合同、严格查询/路径/方法及同Session撤权', async () => {
    let response = await request(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-request-id')).toBeTruthy()
    response = await request('dashboard', 'GET', undefined, memberRaw); expect((await response.json()).data.stats).toEqual({ users: 5, loginSuccess: 2, loginFailed: 1 })
    expect((await request('dashboard?actorId=2')).status).toBe(400); expect((await request('dashboard?period=today')).status).toBe(400)
    expect((await request('dashboard', 'POST', {})).status).toBe(403); expect((await request('dashboard/1')).status).toBe(403)
    await setRolePermissions(client.database, root, partialRole, { version: 3, permissions: ['system.users.read'] }, meta)
    expect((await request('dashboard', 'GET', undefined, memberRaw)).status).toBe(403)
    expect((await createMenuService(client.database).navigation(member)).items.some(item => item.path === '/admin/users')).toBe(true)
  })
  it('匿名/首次改密/禁用与软删除账号均不能获取统计', async () => {
    expect((await fetch(base + '/api/admin/dashboard')).status).toBe(401)
    for (const actor of [disabled, deleted]) await expect(service.overview(actor)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    try { await client.database.update(adminUsers).set({ mustChangePassword: true }).where(eq(adminUsers.id, dashboardOnly)); await expect(service.overview(dashboardOnly)).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' }) } finally { await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, dashboardOnly)) }
  })
})
