import {setRolePermissions, setRoleMenus} from './authorization-fixture'
import { createPersonalProfileService } from '../../server/services/personal-profile'
import { personalProfileHandlers } from '../../server/http/handlers/personal-profile-handlers'
import { auditRepository } from '../../server/repositories/audit'
// 账号管理真实数据库与 HTTP：Root、范围、回滚、会话及密码保密。
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createUserService } from '../../server/services/users'
import { createRoleService } from '../../server/services/roles'
import { createRbacService } from '../../server/services/rbac'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { createDictionaryService } from '../../server/services/dictionaries'
import { accountRepository } from '../../server/repositories/accounts'
import { roleRepository } from '../../server/repositories/roles'
import { userHandlers } from '../../server/http/handlers/user-handlers'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
import { adminUsers, adminUserRoles, adminMenus, adminOperationLogs, adminSessions } from '../../server/db/schema'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, member: bigint, ownRole: string, lowRole: string, broadRole: string, menuRole: string
let users: ReturnType<typeof createUserService>, roles: ReturnType<typeof createRoleService>, auth: ReturnType<typeof createAuthService>, server: Server, base: string, raw: string
const password = 'Users fixture Aurora 80329!', meta = { ip: '127.0.0.1', userAgent: 'users-fixture', requestId: '00000000-0000-4000-8000-000000000001' }, options = { origin: 'http://users.test', secureCookie: false }
async function create(username: string) { return users.create(root, { username, displayName: username, email: null, password }, meta) }
async function login(username: string, secret = password) { const anon = await auth.bootstrap(undefined, meta); return (await auth.login(anon.raw, username, secret, meta)).raw }
async function request(path: string, method = 'GET', body?: object, token = raw, csrf = true) { return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'X-CSRF-Token': csrf ? csrfToken(token) : 'bad', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  member = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'user_operator', displayName: 'Operator', password }, String(root))).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false }); await createRbacService(client.database).sync()
  users = createUserService(client.database, false); roles = createRoleService(client.database); auth = createAuthService(client.database, undefined, false)
  const dictionaries = createDictionaryService(client.database)
  const departmentDictionary = (await dictionaries.list(root, { search: 'account_department' })).items.find(item => item.code === 'account_department')!
  for (const [index, [code, name, enabled]] of ([['quality', '质量组', true], ['maintenance', '维护组', true], ['operations', '运营部', true], ['retired', '已停用部门', false]] as const).entries()) {
    await dictionaries.createItem(root, departmentDictionary.id, { code, name, sortOrder: index, enabled, version: 1 + index }, meta)
  }
  const positionDictionary = (await dictionaries.list(root, { search: 'account_position' })).items.find(item => item.code === 'account_position')!
  for (const [index, [code, name]] of [['admin', '管理员'], ['editor', '编辑'], ['operator', '运维']].entries()) {
    await dictionaries.createItem(root, positionDictionary.id, { code, name, sortOrder: index, enabled: true, version: 1 + index }, meta)
  }
  ownRole = (await roles.create(root, { code: 'user_operator_role', name: 'Operator', enabled: true }, meta)).id
  await setRolePermissions(client.database, root, ownRole, { version: 1, permissions: ['system.users.read', 'system.users.create', 'system.users.update', 'system.users.assign_roles', 'system.users.reset_password', 'system.users.delete', 'system.roles.read'] }, meta)
  await client.database.insert(adminUserRoles).values({ userId: member, roleId: BigInt(ownRole) })
  lowRole = (await roles.create(root, { code: 'low_user_role', name: 'Low', enabled: true }, meta)).id
  await setRolePermissions(client.database, root, lowRole, { version: 1, permissions: ['system.roles.read'] }, meta)
  broadRole = (await roles.create(root, { code: 'broad_user_role', name: 'Broad', enabled: true }, meta)).id
  await setRolePermissions(client.database, root, broadRole, { version: 1, permissions: ['system.roles.delete'] }, meta)
  menuRole = (await roles.create(root, { code: 'menu_user_role', name: 'Menu scope', enabled: true }, meta)).id
  const [menu] = await client.database.select().from(adminMenus).where(eq(adminMenus.code, 'roles'))
  await setRoleMenus(client.database, root, menuRole, { version: 1, menuIds: [String(menu!.id)] }, meta)
  const app = createApp(), router = createRouter(), handler = userHandlers(client.database, options, false), rbac = createRbacService(client.database)
  app.use(defineEventHandler(async event => { ensureRequestId(event); try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (e) { return apiErrorResponse(event, e) } }))
  router.get('/api/admin/users', handler.list).post('/api/admin/users', handler.create); router.get('/api/admin/users/catalog', handler.catalog); router.get('/api/admin/users/profile-catalog', handler.profileCatalog)
  router.get('/api/admin/users/:id', handler.detail).put('/api/admin/users/:id', handler.update).delete('/api/admin/users/:id', handler.remove)
  router.put('/api/admin/users/:id/roles', handler.roles); router.post('/api/admin/users/:id/password', handler.password)
  const profileHandler = personalProfileHandlers(client.database, options)
  router.get('/api/admin/auth/profile', profileHandler.read).put('/api/admin/auth/profile', profileHandler.update)
  app.use(router); server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  raw = await login('root')
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('账号管理纵向交付', () => {
  it('删除后同名账号登录使用新身份，不继承旧会话、角色或登录摘要', async () => {
    const old = await create('reuse_identity')
    await users.assignRoles(root, old.id, { version: 1, roleIds: [lowRole] }, meta)
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, BigInt(old.id)))
    const oldToken = await login(old.username)
    const oldDetail = await users.detail(root, old.id)
    await users.remove(root, old.id, { version: 2 }, meta)
    const freshPassword = 'Different fixture Star 9182!'
    const fresh = await users.create(root, { username: old.username, displayName: 'New identity', email: null, password: freshPassword }, meta)
    const freshDetail = await users.detail(root, fresh.id)
    expect(fresh.id).not.toBe(old.id)
    expect(freshDetail).toMatchObject({ roles: [], roleIds: [], lastLoginAt: null, activeSessionCount: 0, mustChangePassword: true })
    expect(await auth.resolve(oldToken)).toBeNull()
    await expect(login(old.username)).rejects.toMatchObject({ code: 'AUTH_FAILED' })
    const freshToken = await login(old.username, freshPassword)
    expect((await auth.resolve(freshToken))?.user?.id).toBe(BigInt(fresh.id))
    expect((await accountRepository.findById(client.database, BigInt(old.id)))!.username).toBe(old.username)
    expect(oldDetail.lastLoginAt).not.toBeNull()
    expect((await client.database.select().from(adminUserRoles).where(eq(adminUserRoles.userId, BigInt(old.id)))).map(link => String(link.roleId))).toEqual([lowRole])
  })
  it('本人资料不依赖管理权限，严格限制字段、目标身份与版本；Root 和强制改密仍受保护', async () => {
    const row = await create('personal_fixture'), id = BigInt(row.id)
    const profile = createPersonalProfileService(client.database)
    await expect(profile.read(id)).rejects.toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' })
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, id))
    const token = await login(row.username)
    expect((await request('auth/profile', 'GET', undefined, token)).status).toBe(200)
    expect((await request('auth/profile', 'PUT', { version: 1, displayName: '本人资料', email: 'self@example.test', phone: '12345', department: ' operations ', position: 'editor' }, token)).status).toBe(200)
    expect(await profile.read(id)).toMatchObject({ displayName: '本人资料', version: 2, department: 'operations', position: 'editor', dictionaryCatalog: { departments: { enabled: true }, positions: { enabled: true } } })
    expect((await request('auth/profile', 'PUT', { version: 2, displayName: '越权', email: null, id: String(root) }, token)).status).toBe(400)
    expect((await request('auth/profile', 'PUT', { version: 2, displayName: '越权', email: null, remark: '管理备注' }, token)).status).toBe(400)
    expect((await request('auth/profile', 'PUT', { version: 2, displayName: '未保存', email: null }, token, false)).status).toBe(403)
    await expect(profile.update(id, { version: 1, displayName: '旧版本', email: null }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await request('auth/profile', 'PUT', { version: 2, displayName: '本人资料', email: null, department: 'x'.repeat(81) }, token)).status).toBe(400)
    const rootRow = await profile.read(root)
    await expect(profile.update(root, { version: rootRow.version, displayName: '不可修改', email: null }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const audit = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture failure'))
    try { await expect(profile.update(id, { version: 2, displayName: '不应保存', email: null }, meta)).rejects.toThrow() } finally { audit.mockRestore() }
    expect(await profile.read(id)).toMatchObject({ displayName: '本人资料', version: 2, department: 'operations', position: 'editor' })
    expect((await auth.resolve(token))?.user?.id).toBe(id)
  })
  it('列表返回角色与成功登录时间；详情只统计尚未过期的有效会话', async () => {
    const row = await create('summary_fixture'), id = BigInt(row.id)
    await users.assignRoles(root, row.id, { version: 1, roleIds: [lowRole] }, meta)
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, id))
    const before = (await users.list(root, { search: row.username })).items[0]!
    expect(before.roles).toEqual([{ id: lowRole, name: 'Low', enabled: true }])
    expect(before.lastLoginAt).toBeNull()
    await login(row.username)
    const detail = await users.detail(root, row.id)
    expect(detail.activeSessionCount).toBe(1)
    expect(detail.lastLoginAt).not.toBeNull()
    expect(detail.lastActivityAt).not.toBeNull()
    expect(JSON.stringify(detail)).not.toMatch(/tokenHash|passwordHash|csrfToken/)
    await client.database.update(adminSessions).set({ lastActivityAt: new Date(Date.now() - 3600_000) }).where(eq(adminSessions.userId, id))
    expect((await users.detail(root, row.id)).activeSessionCount).toBe(0)
    expect((await users.list(root, { search: row.username })).items[0]!.lastLoginAt).toBe(detail.lastLoginAt)
  })
  it('BF-05A 可空资料字段创建/读取/清空，状态与资料更新相互独立', async () => {
    const row = await users.create(root, { username: 'bf05a_profile', displayName: '内部账号', email: 'internal@example.test', password, phone: '+86 010 12345678', department: 'maintenance', position: 'admin', remark: '内部维护\n预留资料' }, meta)
    expect(row).toMatchObject({ phone: '+86 010 12345678', department: 'maintenance', position: 'admin', remark: '内部维护\n预留资料' })
    await users.update(root, row.id, { version: 1, enabled: false }, meta)
    expect(await users.detail(root, row.id)).toMatchObject({ enabled: false, displayName: '内部账号', email: 'internal@example.test', phone: '+86 010 12345678', department: 'maintenance', position: 'admin', remark: '内部维护\n预留资料' })
    await users.update(root, row.id, { version: 2, phone: ' ', department: null, position: '', remark: '  用途更新  ' }, meta)
    expect(await users.detail(root, row.id)).toMatchObject({ enabled: false, phone: null, department: null, position: null, remark: '用途更新', email: 'internal@example.test' })
    await users.update(root, row.id, { version: 3, enabled: true }, meta)
    expect((await users.detail(root, row.id)).remark).toBe('用途更新')
    const plain = await create('bf05a_empty')
    expect(plain).toMatchObject({ phone: null, department: null, position: null, remark: null })
    await expect(users.update(member, row.id, { version: 4, phone: 'x'.repeat(33) }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const logs = JSON.stringify(await client.database.select().from(adminOperationLogs), (_key, value) => typeof value === 'bigint' ? String(value) : value)
    expect(logs).not.toContain('+86 010 12345678')
    expect(logs).not.toContain('内部维护\\n预留资料')
  })
  it('BF-05A HTTP 接受可空资料和状态单独提交，拒绝空更新及非法字段', async () => {
    const created = await request('users', 'POST', { username: 'bf05a_http', displayName: 'HTTP fixture', email: null, password, phone: '  +44 20 12345678  ', department: ' ', position: 'operator', remark: null })
    expect(created.status).toBe(200)
    const row = (await created.json()).data
    expect(row).toMatchObject({ phone: '+44 20 12345678', department: null, position: 'operator', remark: null })
    expect((await request(`users/${row.id}`, 'PUT', { version: 1, enabled: false })).status).toBe(200)
    const response = await request(`users/${row.id}`)
    expect((await response.json()).data).toMatchObject({ enabled: false, phone: '+44 20 12345678', position: 'operator', version: 2 })
    expect((await request(`users/${row.id}`, 'PUT', { version: 2 })).status).toBe(400)
    expect((await request(`users/${row.id}`, 'PUT', { version: 2, department: 'Admin', isRoot: true })).status).toBe(400)
    expect((await request(`users/${row.id}`, 'PUT', { version: 1, remark: '过期更新' })).status).toBe(409)
    expect((await request(`users/${row.id}`, 'PUT', { version: 2, phone: '', position: null, remark: '说明' })).status).toBe(200)
    expect((await request(`users/${row.id}`, 'PUT', { version: 3, department: 'retired' })).status).toBe(400)
    expect((await request(`users/${row.id}`, 'PUT', { version: 3, department: 'unknown_department' })).status).toBe(400)
    const catalog = await request('users/profile-catalog')
    expect(catalog.status).toBe(200)
    expect((await catalog.json()).data).toMatchObject({
      departments: { enabled: true, options: expect.arrayContaining([{ code: 'quality', name: '质量组', enabled: true }, { code: 'retired', name: '已停用部门', enabled: false }]) },
      positions: { enabled: true, options: expect.arrayContaining([{ code: 'operator', name: '运维', enabled: true }]) },
    })
  })
  it('已分配部门停用后仍可保留原值并保存其他资料，新值继续拒绝', async () => {
    const dictionaries = createDictionaryService(client.database)
    const department = (await dictionaries.list(root, { search: 'account_department' })).items.find(item => item.code === 'account_department')!
    const before = await dictionaries.detail(root, department.id)
    const quality = before.items.find(item => item.code === 'quality')!
    const row = await users.create(root, { username: 'dictionary_retained', displayName: 'Retained', email: null, password, department: 'quality' }, meta)
    await dictionaries.updateItem(root, quality.id, { dictionaryId: department.id, name: quality.name, sortOrder: quality.sortOrder, enabled: false, version: before.version }, meta)
    await users.update(root, row.id, { version: 1, department: 'quality', remark: '保留已停用部门' }, meta)
    expect(await users.detail(root, row.id)).toMatchObject({ department: 'quality', remark: '保留已停用部门', version: 2 })
    await expect(users.update(root, row.id, { version: 2, department: 'retired' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('创建、有效账号用户名唯一/删除后复用、DTO 脱敏、查询分页与不可变字段', async () => {
    const row = await create('Member_New'); expect(row.username).toBe('member_new'); expect(row.mustChangePassword).toBe(true)
    expect(row).not.toHaveProperty('passwordHash'); expect(row).not.toHaveProperty('password')
    await expect(create('MEMBER_NEW')).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(users.create(root, { username: 'root', displayName: 'Fake', email: null, password }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.update(root, row.id, { version: 1, displayName: 'New', email: null, enabled: true, isRoot: true }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const list = await users.list(root, { search: 'member_new', pageSize: '10', status: 'enabled' }); expect(list.total).toBe(1); expect(list.pageSize).toBe(10)
    await expect(users.list(root, { sort: 'username' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await users.remove(root, row.id, { version: 1 }, meta)
    expect((await users.list(root, { search: 'member_new' })).total).toBe(0)
    const reused = await create('member_new')
    expect(reused.id).not.toBe(row.id)
    expect((await users.detail(root, reused.id)).roleIds).toEqual([])
    await expect(users.detail(root, row.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await users.list(root, { search: 'member_new' })).total).toBe(1)
  })
  it('Root 与本人高风险保护不可通过 API 字段或角色授予绕过', async () => {
    expect((await users.detail(root, String(root))).manageable).toBe(false)
    const data = { version: 1, displayName: 'Forbidden', email: null, enabled: false }
    await expect(users.update(root, String(root), data, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.assignRoles(root, String(root), { version: 1, roleIds: [lowRole] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.resetPassword(root, String(root), { version: 1, password: '123456' }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.remove(root, String(root), { version: 1 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.assignRoles(member, String(member), { version: 1, roleIds: [] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.remove(member, String(member), { version: 1 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.update(member, String(member), data, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('BF-05 列表/详情操作能力与服务端保护一致，操作者名称及ID同时保留', async () => {
    const target = await create('bf05_actions')
    const detail = await users.detail(root, target.id)
    expect(detail.actions).toEqual({ profile: true, roles: true, resetPassword: true, delete: true })
    expect(detail.createdBy).toBe(String(root))
    expect(detail.createdByName).toBe((await accountRepository.findById(client.database, root))!.displayName)
    expect((await users.detail(root, String(root))).actions).toEqual({ profile: false, roles: false, resetPassword: false, delete: false })
    expect((await users.detail(member, String(member))).actions).toEqual({ profile: false, roles: false, resetPassword: false, delete: false })
    await users.assignRoles(root, target.id, { version: 1, roleIds: [broadRole] }, meta)
    const scoped = await users.detail(member, target.id)
    expect(scoped.actions).toEqual({ profile: false, roles: false, resetPassword: false, delete: false })
    const list = await users.list(member, { search: 'bf05_actions' })
    expect(list.items[0]!.actions).toEqual(scoped.actions)
    expect(JSON.stringify(list)).not.toMatch(/passwordHash|password|csrfToken/)
    await expect(users.update(member, target.id, { version: 2, displayName: 'Attempt', email: null, enabled: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('BF-05 只读账号投影无写入能力，全部写接口独立拒绝', async () => {
    const readerRole = await roles.create(root, { code: 'bf05_reader', name: '只读角色', enabled: true }, meta)
    await setRolePermissions(client.database, root, readerRole.id, { version: 1, permissions: ['system.users.read'] }, meta)
    const reader = await create('bf05_reader'), target = await create('bf05_read_target')
    await users.assignRoles(root, reader.id, { version: 1, roleIds: [readerRole.id] }, meta)
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, BigInt(reader.id)))
    const token = await login(reader.username)
    const response = await request(`users/${target.id}`, 'GET', undefined, token)
    expect(response.status).toBe(200)
    expect((await response.json()).data.actions).toEqual({ profile: false, roles: false, resetPassword: false, delete: false })
    for (const [path, method, body] of [
      [`users/${target.id}`, 'PUT', { version: 1, displayName: 'No', email: null, enabled: true }],
      [`users/${target.id}/roles`, 'PUT', { version: 1, roleIds: [] }],
      [`users/${target.id}/password`, 'POST', { version: 1, password: 'Forbidden 38520!' }],
      [`users/${target.id}`, 'DELETE', { version: 1 }],
    ] as const) expect((await request(path, method, body, token)).status).toBe(403)
    const list = await request('users?search=bf05_read_target', 'GET', undefined, token)
    expect((await list.json()).data.items[0].actions.profile).toBe(false)
  })
  it('普通管理员不能分配超范围权限/菜单，不能重置或清空高权限账号', async () => {
    const row = await create('scope_target')
    await expect(users.assignRoles(member, row.id, { version: 1, roleIds: [broadRole] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.assignRoles(member, row.id, { version: 1, roleIds: [menuRole] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await users.assignRoles(member, row.id, { version: 1, roleIds: [lowRole] }, meta)
    await users.assignRoles(root, row.id, { version: 2, roleIds: [broadRole] }, meta)
    expect((await users.detail(member, row.id)).manageable).toBe(false)
    await expect(users.assignRoles(member, row.id, { version: 3, roleIds: [] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.resetPassword(member, row.id, { version: 3, password: '123456' }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(users.remove(member, row.id, { version: 3 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('禁用角色不能新分配；已有禁用关联可保留或清理，不因禁用绕过权限上限', async () => {
    const role = await roles.create(root, { code: 'disabled_user_role', name: 'Disabled', enabled: true }, meta), row = await create('disabled_role_target')
    await users.assignRoles(root, row.id, { version: 1, roleIds: [role.id] }, meta)
    await roles.update(root, role.id, { version: 1, name: 'Disabled', enabled: false }, meta)
    await users.assignRoles(root, row.id, { version: 2, roleIds: [role.id, lowRole] }, meta)
    const other = await create('disabled_new_target')
    await expect(users.assignRoles(root, other.id, { version: 1, roleIds: [role.id] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await users.assignRoles(root, row.id, { version: 3, roleIds: [] }, meta)
  })
  it('多角色变更下一次请求生效，资料/角色独立权限与乐观锁', async () => {
    const row = await create('roles_target')
    await users.assignRoles(root, row.id, { version: 1, roleIds: [lowRole, menuRole] }, meta)
    expect((await users.detail(root, row.id)).roleIds.sort()).toEqual([lowRole, menuRole].sort())
    await expect(users.update(root, row.id, { version: 1, displayName: 'Stale', email: null, enabled: true }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
    const noPermission = BigInt((await create('no_permission')).id)
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, noPermission))
    await expect(users.list(noPermission, {})).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const current = await accountRepository.findById(client.database, member)
    await expect(users.update(member, String(member), { version: current!.version, displayName: 'Self profile', email: null, enabled: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('资料修改不撤销会话；禁用、重置和软删除原子撤销，重置强制改密', async () => {
    for (const action of ['profile', 'disable', 'password', 'delete']) {
      const row = await create(`session_${action}`)
      await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, BigInt(row.id)))
      const token = await login(row.username)
      if (action === 'profile') await users.update(root, row.id, { version: 1, displayName: 'New profile', email: 'fixture@example.test', enabled: true }, meta)
      if (action === 'disable') await users.update(root, row.id, { version: 1, displayName: row.displayName, email: null, enabled: false }, meta)
      if (action === 'password') await users.resetPassword(root, row.id, { version: 1, password: '123456' }, meta)
      if (action === 'delete') await users.remove(root, row.id, { version: 1 }, meta)
      expect(!!await auth.resolve(token)).toBe(action === 'profile')
      if (action === 'password') { const token = await login(row.username, '123456'); expect((await auth.resolve(token))!.user!.mustChangePassword).toBe(true) }
    }
  })
  it('账号角色调整在同一 Session 下一次 HTTP 请求立即生效', async () => {
    const row = await create('live_role_target')
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, BigInt(row.id)))
    await users.assignRoles(root, row.id, { version: 1, roleIds: [lowRole] }, meta)
    const token = await login(row.username)
    expect((await request('users', 'GET', undefined, token)).status).toBe(403)
    const role = await roles.create(root, { code: 'live_user_reader', name: 'Reader', enabled: true }, meta)
    await setRolePermissions(client.database, root, role.id, { version: 1, permissions: ['system.users.read'] }, meta)
    await users.assignRoles(root, row.id, { version: 2, roleIds: [role.id] }, meta)
    expect((await request('users', 'GET', undefined, token)).status).toBe(200)
    await users.assignRoles(root, row.id, { version: 3, roleIds: [] }, meta)
    expect((await request('users', 'GET', undefined, token)).status).toBe(403)
  })
  it('密码名单开关沿用创建与重置路径，关闭完全跳过名单', async () => {
    const checked = createUserService(client.database, true)
    await expect(checked.create(root, { username: 'blocked_user', displayName: 'Blocked', email: null, password: '123456' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const row = await users.create(root, { username: 'unblocked_user', displayName: 'Unblocked', email: null, password: '123456' }, meta)
    await expect(checked.resetPassword(root, row.id, { version: 1, password: 'passwordpassword' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await users.resetPassword(root, row.id, { version: 1, password: 'passwordpassword' }, meta)
  })
  it('审计失败回滚新建、角色、状态和会话撤销；日志脱敏', async () => {
    const row = await create('rollback_target')
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, BigInt(row.id)))
    const token = await login(row.username)
    for (const action of ['create', 'roles', 'disable', 'password']) {
      const audit = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture failure'))
      try {
        const work = action === 'create' ? create('rollback_created') : action === 'roles' ? users.assignRoles(root, row.id, { version: 1, roleIds: [lowRole] }, meta) : action === 'password' ? users.resetPassword(root, row.id, { version: 1, password: '123456' }, meta) : users.update(root, row.id, { version: 1, displayName: row.displayName, email: null, enabled: false }, meta)
        await expect(work).rejects.toThrow('audit fixture failure')
      } finally { audit.mockRestore() }
      expect((await users.detail(root, row.id)).version).toBe(1); expect((await users.detail(root, row.id)).roleIds).toEqual([]); expect(await auth.resolve(token)).not.toBeNull()
    }
    expect(await accountRepository.findByUsername(client.database, 'rollback_created')).toBeUndefined()
    const logs = JSON.stringify(await client.database.select().from(adminOperationLogs), (_, value) => typeof value === 'bigint' ? String(value) : value)
    for (const secret of [password, token, 'passwordHash', '123456', 'passwordpassword']) expect(logs).not.toContain(secret)
    expect((await client.database.select().from(adminSessions)).length).toBeGreaterThan(0)
  })
  it('同版本并发写只有一个成功；角色分配不要求资料编辑权限', async () => {
    const row = await create('concurrent_user')
    const results = await Promise.allSettled(['First', 'Second'].map(displayName => users.update(root, row.id, { version: 1, displayName, email: null, enabled: true }, meta)))
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(item => item.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } })
    const operatorRole = await roleRepository.find(client.database, BigInt(ownRole))
    await setRolePermissions(client.database, root, ownRole, { version: operatorRole!.version, permissions: ['system.users.read', 'system.users.assign_roles', 'system.roles.read'] }, meta)
    await users.assignRoles(member, row.id, { version: 2, roleIds: [lowRole] }, meta)
    await expect(users.update(member, row.id, { version: 3, displayName: 'Forbidden', email: null, enabled: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('真实 HTTP 创建/编辑/角色/重置/软删除、CSRF、非法方法路径及 DTO 保密', async () => {
    expect((await fetch(base + '/api/admin/users')).status).toBe(401)
    expect((await request('users', 'POST', { username: 'http_user', displayName: 'HTTP', email: null, password }, raw, false)).status).toBe(403)
    expect((await request('users', 'POST', { username: 'http_user', displayName: 'HTTP', email: null, password, isRoot: true })).status).toBe(400)
    const response = await request('users', 'POST', { username: 'http_user', displayName: 'HTTP', email: null, password }); expect(response.status).toBe(200)
    const payload = await response.json(), id = payload.data.id; expect(JSON.stringify(payload)).not.toContain(password); expect(JSON.stringify(payload)).not.toContain('passwordHash')
    expect((await request('users/catalog')).status).toBe(200); expect((await request(`users/${id}`)).status).toBe(200)
    expect((await request(`users/${id}/roles`, 'PUT', { version: 1, roleIds: [lowRole] })).status).toBe(200)
    expect((await request(`users/${id}`, 'PUT', { version: 1, displayName: 'Stale', email: null, enabled: true })).status).toBe(409)
    expect((await request(`users/${id}/password`, 'POST', { version: 2, password: '123456' })).status).toBe(200)
    const token = await login('http_user', '123456')
    expect((await request('users', 'GET', undefined, token)).status).toBe(403)
    expect((await request(`users/${id}`, 'DELETE', { version: 3 })).status).toBe(200)
    expect((await request(`users/${id}`)).status).toBe(404)
    for (const path of ['users/01', 'users/1/extra', 'users/1/roles/extra']) expect((await request(path, 'PUT', {})).status).toBe(403)
    const rows = await (await request('users')).json(); expect(JSON.stringify(rows)).not.toContain('passwordHash')
  })
})
