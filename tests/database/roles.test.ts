import {menuRepository} from '../../server/repositories/menus'
import {createRoleAuthorizationService} from '../../server/services/role-authorization'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { auditRepository } from '../../server/repositories/audit'
// 角色纵向业务真实库测试：完整授权边界、冲突、审计和事务，不接触开发库。
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createRbacService } from '../../server/services/rbac'
import { createRoleService } from '../../server/services/roles'
import { roleHandlers } from '../../server/http/handlers/role-handlers'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
import { adminRoles, adminUsers, adminPermissions, adminRolePermissions, adminUserRoles, adminOperationLogs } from '../../server/db/schema'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, ordinary: bigint, ownRole: bigint
let roles: ReturnType<typeof createRoleService>
let server: Server, base: string
const httpOptions = { origin: 'http://roles.test', secureCookie: false }
const meta = { ip: '127.0.0.1', userAgent: 'roles-fixture', requestId: '00000000-0000-4000-8000-000000000001' }
async function bindRolesMenu(id: string) {
  const menu = (await menuRepository.all(client.database)).find(row => row.pageKey === 'roles')!
  await menuRepository.replace(client.database, BigInt(id), [menu.id])
}
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, 'Root fixture 80346!')).id)
  ordinary = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'role_operator', displayName: 'Operator', password: 'Operator fixture 9804!' }, String(root))).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  await createRbacService(client.database).sync(); roles = createRoleService(client.database)
  await client.database.insert(adminRoles).values(await withEntityIds(client.database, 'admin_roles', { code: 'operator_role', name: 'Operator' }))
  ownRole = (await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'operator_role')))[0]!.id
  const codes = await client.database.select().from(adminPermissions)
  await client.database.insert(adminRolePermissions).values(codes.filter(p => ['system.roles.read', 'system.roles.create', 'system.roles.update', 'system.roles.assign_permissions'].includes(p.code)).map(p => ({ roleId: ownRole, permissionId: p.id })))
  await client.database.insert(adminUserRoles).values({ userId: ordinary, roleId: ownRole })
  const auth = createAuthService(client.database), rbac = createRbacService(client.database)
  const app = createApp(), router = createRouter(), handlers = roleHandlers(client.database, httpOptions)
  app.use(defineEventHandler(async event => {
    ensureRequestId(event)
    try { await guardAdminRequest(event, auth, httpOptions, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) }
  }))
  router.get('/api/admin/roles', handlers.list).post('/api/admin/roles', handlers.create)
  router.get('/api/admin/roles/catalog', handlers.catalog)
  router.get('/api/admin/roles/:id', handlers.detail).put('/api/admin/roles/:id', handlers.update).delete('/api/admin/roles/:id', handlers.remove)
  router.put('/api/admin/roles/:id/authorization', handlers.assignRoleAuthorization)
  app.use(router)
  server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('角色与授权', () => {
  it('角色列表批量统计关联账号，包含禁用账号且排除软删除账号，不泄露账号资料', async () => {
    const role = await roles.create(root, { code: 'count_fixture', name: 'Count fixture', enabled: true }, meta)
    const accounts = createAccountService(client.database, false)
    const disabled = await accounts.createOrdinary({ username: 'count_disabled', displayName: 'Disabled', password: 'Count fixture 9804!' }, String(root))
    const deleted = await accounts.createOrdinary({ username: 'count_deleted', displayName: 'Deleted', password: 'Count fixture 9804!' }, String(root))
    await client.database.update(adminUsers).set({ enabled: false }).where(eq(adminUsers.id, BigInt(disabled.id)))
    await client.database.update(adminUsers).set({ deletedAt: new Date(), enabled: false }).where(eq(adminUsers.id, BigInt(deleted.id)))
    await client.database.insert(adminUserRoles).values([ordinary, BigInt(disabled.id), BigInt(deleted.id)].map(userId => ({ userId, roleId: BigInt(role.id) })))
    const result = await roles.list(ordinary, { pageSize: '10', search: 'count_fixture' })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: role.id, userCount: 2 })
    expect(result.items[0]).not.toHaveProperty('users')
    expect((await roles.list(root, { pageSize: '10', search: 'missing_count' })).items).toEqual([])
    const unused = await roles.create(root, { code: 'count_empty', name: 'Count empty', enabled: false }, meta)
    expect((await roles.list(root, { pageSize: '10', search: 'count_empty', status: 'disabled' })).items[0]).toMatchObject({ id: unused.id, userCount: 0 })
    await client.database.delete(adminUserRoles).where(eq(adminUserRoles.roleId, BigInt(role.id)))
    await roles.remove(root, role.id, { version: 1 }, meta)
    await roles.remove(root, unused.id, { version: 1 }, meta)
  })
  it('创建、分页/状态/搜索、固定排序和不可变编码', async () => {
    const created = await roles.create(root, { code: 'fixture_one', name: 'First', enabled: true }, meta)
    const detail = await roles.detail(root, created.id)
    expect(detail.createdBy).toBe(String(root)); expect(detail.permissions).toEqual([])
    const list = await roles.list(root, { pageSize: '10', search: 'fixture_one', status: 'enabled' })
    expect(list.total).toBe(1); expect(list.items[0]!.id).toBe(created.id)
    await expect(roles.list(root, { sort: 'code' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(roles.create(root, { code: 'fixture_one', name: 'Duplicate', enabled: true }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'DUPLICATE' })
    await expect(roles.update(root, created.id, { name: 'Rename', enabled: true, code: 'changed', version: 1 }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await roles.update(root, created.id, { name: 'Updated', enabled: false, version: 1 }, meta)
    await expect(roles.update(root, created.id, { name: 'Stale', enabled: true, version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
    expect((await roles.detail(root, created.id)).name).toBe('Updated')
  })
  it('权限分配独立授权，拒绝预留、未知、隐式本人权限及普通越权', async () => {
    const created = await roles.create(root, { code: 'grant_target', name: 'Grant', enabled: true }, meta)
    await bindRolesMenu(created.id)
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, created.id, {version: 1, permissions: ['system.roles.read', 'system.roles.delete'], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)
    expect((await roles.detail(root, created.id)).version).toBe(2)
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(ordinary, created.id, {version: 2, permissions: ['system.roles.read'], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    for (const code of ['system.dictionaries.write', 'made.up.code', 'account.permissions.read']) await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, created.id, {version: 2, permissions: [code], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const manageable = await roles.create(ordinary, { code: 'normal_target', name: 'Normal', enabled: true }, meta)
    await bindRolesMenu(manageable.id)
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(ordinary, manageable.id, {version: 1, permissions: ['system.roles.delete'], menuIds: (await menuRepository.roleIds(client.database, BigInt(manageable.id))).map(String)}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(ordinary, manageable.id, {version: 1, permissions: ['system.roles.read'], menuIds: (await menuRepository.roleIds(client.database, BigInt(manageable.id))).map(String)}, meta)
    expect((await roles.detail(root, manageable.id)).permissions).toEqual(['system.roles.read'])
  })
  it('被引用角色不能删除；administrator 编码普通创建/删除；无引用删除清关联', async () => {
    await expect(roles.remove(root, String(ownRole), { version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'REFERENCED' })
    const basic = await roles.create(root, { code: 'administrator', name: '自定义管理员', enabled: true }, meta)
    await bindRolesMenu(basic.id)
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, basic.id, {version: 1, permissions: ['system.roles.read'], menuIds: (await menuRepository.roleIds(client.database, BigInt(basic.id))).map(String)}, meta)
    await roles.remove(root, basic.id, { version: 2 }, meta)
    await createRbacService(client.database).sync()
    expect(await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'administrator'))).toEqual([])
    const created = await roles.create(root, { code: 'removable', name: 'Delete', enabled: true }, meta)
    await bindRolesMenu(created.id)
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, created.id, {version: 1, permissions: ['system.roles.read'], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)
    await roles.remove(root, created.id, { version: 2 }, meta)
    await expect(roles.detail(root, created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(roles.remove(ordinary, '999999', { version: 1 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('独立 assign 权限无需 metadata update，授权撤销即时生效', async () => {
    const created = await roles.create(root, { code: 'independent', name: 'Independent', enabled: true }, meta)
    await bindRolesMenu(created.id)
    const update = (await client.database.select().from(adminPermissions).where(eq(adminPermissions.code, 'system.roles.update')))[0]!
    await client.database.delete(adminRolePermissions).where(eq(adminRolePermissions.permissionId, update.id))
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(ordinary, created.id, {version: 1, permissions: ['system.roles.read'], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)
    await expect(roles.update(ordinary, created.id, { name: 'Forbidden', enabled: true, version: 2 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('事务失败保持授权/版本不变，审计只存白名单快照和结果', async () => {
    const created = await roles.create(root, { code: 'atomic_role', name: 'Atomic snapshot', enabled: true }, meta)
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, created.id, {version: 1, permissions: ['system.menus.write'], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const row = await roles.detail(root, created.id); expect(row.version).toBe(1); expect(row.permissions).toEqual([])
    const logs = await client.database.select().from(adminOperationLogs)
    expect(logs.some(log => log.action === 'roles.permissions' && log.result === 'failed')).toBe(true)
    expect(logs.some(log => log.action === 'roles.create' && log.targetName === 'Atomic snapshot')).toBe(true)
    expect(logs.filter(log => log.targetType === 'role').every(log => log.requestId === meta.requestId)).toBe(true)
    expect(logs.find(log => log.action === 'rbac_sync')).toMatchObject({ actorId: null, targetType: 'maintenance' })
    expect(JSON.stringify(logs, (_, value) => typeof value === 'bigint' ? String(value) : value)).not.toContain('password')
  })
  it('成功审计写入失败时回滚已修改的数据，随后保留失败记录', async () => {
    const created = await roles.create(root, { code: 'rollback_role', name: 'Before', enabled: true }, meta)
    const failure = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture failure'))
    try {
      await expect(roles.update(root, created.id, { name: 'After', enabled: false, version: 1 }, meta)).rejects.toThrow('audit fixture failure')
    } finally { failure.mockRestore() }
    const row = await roles.detail(root, created.id)
    expect(row.name).toBe('Before'); expect(row.enabled).toBe(true); expect(row.version).toBe(1)
    expect((await client.database.select().from(adminOperationLogs)).some(log => log.targetId === created.id && log.action === 'roles.update' && log.result === 'failed')).toBe(true)
  })
  it('两个相同版本并发保存只允许一个成功', async () => {
    const created = await roles.create(root, { code: 'concurrent_role', name: 'Before', enabled: true }, meta)
    const results = await Promise.allSettled(['First', 'Second'].map(name => roles.update(root, created.id, { name, enabled: true, version: 1 }, meta)))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } })
    expect((await roles.detail(root, created.id)).version).toBe(2)
  })
  it('历史废弃权限保留关联，但只能由 Root 清理且不能重新授予', async () => {
    const created = await roles.create(root, { code: 'retired_role', name: 'Retired', enabled: true }, meta)
    await client.database.insert(adminPermissions).values(await withEntityIds(client.database, 'admin_permissions', {code: 'retired.fixture.write', name: 'Historical fixture', available: false}))
    const reserved = (await client.database.select().from(adminPermissions).where(eq(adminPermissions.code, 'retired.fixture.write')))[0]!
    await client.database.insert(adminRolePermissions).values({ roleId: BigInt(created.id), permissionId: reserved.id })
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(ordinary, created.id, {version: 1, permissions: [], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, created.id, {version: 1, permissions: [], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)
    expect((await roles.detail(root, created.id)).permissions).toEqual([])
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, created.id, {version: 2, permissions: [reserved.code], menuIds: (await menuRepository.roleIds(client.database, BigInt(created.id))).map(String)}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('真实 HTTP CRUD、CSRF、方法/路径白名单、Zod、409 与权限撤销', async () => {
    const auth = createAuthService(client.database)
    const anon = await auth.bootstrap(undefined, meta)
    const { raw } = await auth.login(anon.raw, 'root', 'Root fixture 80346!', meta)
    async function request(path: string, method = 'GET', body?: object, csrf = true) {
      return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${raw}`, Origin: httpOptions.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf ? csrfToken(raw) : 'bad' }, body: body === undefined ? undefined : JSON.stringify(body) })
    }
    expect((await fetch(base + '/api/admin/roles')).status).toBe(401)
    expect((await request('roles', 'POST', { code: 'http_role', name: 'HTTP', enabled: true }, false)).status).toBe(403)
    expect((await request('roles', 'POST', { code: 'root', name: 'HTTP', enabled: true })).status).toBe(400)
    const created = await request('roles', 'POST', { code: 'http_role', name: 'HTTP', enabled: true })
    expect(created.status).toBe(200)
    const { data: { id } } = await created.json()
    expect((await request('roles/catalog')).status).toBe(200)
    expect((await request(`roles/${id}`)).status).toBe(200)
    await bindRolesMenu(id)
    expect((await request(`roles/${id}/permissions`, 'PUT', {version: 1, permissions: ['system.roles.read']})).status).toBe(403)
    expect((await request(`roles/${id}/authorization`, 'PUT', {version: 1, permissions: ['system.roles.read'], menuIds: (await menuRepository.roleIds(client.database, BigInt(id))).map(String)})).status).toBe(200)
    expect((await request(`roles/${id}`, 'PUT', { version: 1, name: 'Stale', enabled: true })).status).toBe(409)
    for (const path of [`roles/${id}/extra`, 'roles/01', 'roles/-1', 'roles/1e2']) expect((await request(path)).status).toBe(403)
    expect((await request(`roles/${id}`, 'POST', {})).status).toBe(403)
    expect((await request(`roles/${id}`, 'DELETE', { version: 2 })).status).toBe(200)
    expect((await request(`roles/${id}`)).status).toBe(404)
    const anonymous = await auth.bootstrap(undefined, meta)
    const member = await auth.login(anonymous.raw, 'role_operator', 'Operator fixture 9804!', meta)
    const headers = { Cookie: `${SESSION_COOKIE}=${member.raw}` }
    expect((await fetch(base + '/api/admin/roles', { headers })).status).toBe(200)
    await roles.update(root, String(ownRole), { name: 'Disabled operator', enabled: false, version: 1 }, meta)
    expect((await fetch(base + '/api/admin/roles', { headers })).status).toBe(403)
  })
})

