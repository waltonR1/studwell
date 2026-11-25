import {createWebsitePageDeletionService} from '../../server/services/website-page-deletion'
import {setRolePermissions, setRoleMenus} from './authorization-fixture'
import {createRoleAuthorizationService} from '../../server/services/role-authorization'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { auditRepository } from '../../server/repositories/audit'
// 专用 MySQL/HTTP 菜单纵向测试，绝不连接或迁移开发库。
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createMenuService } from '../../server/services/menus'
import { createRoleService } from '../../server/services/roles'
import { createRbacService } from '../../server/services/rbac'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { roleRepository } from '../../server/repositories/roles'
import { menuHandlers } from '../../server/http/handlers/menu-handlers'
import { roleHandlers } from '../../server/http/handlers/role-handlers'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { adminMenus, adminRoleMenus, adminRoles, adminPermissions, adminRolePermissions, adminUserRoles, adminUsers, adminOperationLogs } from '../../server/db/schema'
import { permissionCatalog, adminRoutePolicies } from '../../server/config/permissions'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, member: bigint, empty: bigint, ownRole: bigint
let menus: ReturnType<typeof createMenuService>, roles: ReturnType<typeof createRoleService>, rbac: ReturnType<typeof createRbacService>, auth: ReturnType<typeof createAuthService>
let server: Server, base: string, raw: string
const password = 'Menus fixture 98206!', meta = { ip: '127.0.0.1', userAgent: 'menu-fixture', requestId: '00000000-0000-4000-8000-000000000001' }, options = { origin: 'http://menus.test', secureCookie: false }
const directory = (code: string, parentId: string | null = null) => ({ iconKey: 'folder', code, name: code, parentId, pageKey: null, sortOrder: 100, visible: true })
async function roleVersion(id: bigint) { return (await roleRepository.find(client.database, id))!.version }
async function rowByCode(code: string) { return (await client.database.select().from(adminMenus).where(eq(adminMenus.code, code)))[0]! }
async function request(path: string, method = 'GET', body?: object, token = raw, csrf = true) {
  return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf ? csrfToken(token) : 'bad' }, body: body === undefined ? undefined : JSON.stringify(body) })
}
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  const accounts = createAccountService(client.database, false)
  member = BigInt((await accounts.createOrdinary({ username: 'menu_member', displayName: 'Member', password }, String(root))).id)
  empty = BigInt((await accounts.createOrdinary({ username: 'menu_empty', displayName: 'Empty', password }, String(root))).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  rbac = createRbacService(client.database); menus = createMenuService(client.database); roles = createRoleService(client.database); auth = createAuthService(client.database)
  await rbac.sync()
  await client.database.insert(adminRoles).values(await withEntityIds(client.database, 'admin_roles', { code: 'menu_operator', name: 'Menu operator' }))
  ownRole = (await client.database.select().from(adminRoles).where(eq(adminRoles.code, 'menu_operator')))[0]!.id
  const permissions = await client.database.select().from(adminPermissions)
  const codes = ['system.roles.read', 'system.roles.assign_menus', 'system.menus.read', 'system.menus.create', 'system.menus.update', 'system.menus.delete']
  await client.database.insert(adminRolePermissions).values(permissions.filter(p => codes.includes(p.code)).map(p => ({ roleId: ownRole, permissionId: p.id })))
  await client.database.insert(adminUserRoles).values({ userId: member, roleId: ownRole })
  const menu = await rowByCode('roles')
  await setRoleMenus(client.database, root, String(ownRole), { version: 1, menuIds: [String(menu.id)] }, meta)
  const app = createApp(), router = createRouter(), handler = menuHandlers(client.database, options), roleHandler = roleHandlers(client.database, options)
  app.use(defineEventHandler(async event => { ensureRequestId(event); try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (e) { return apiErrorResponse(event, e) } }))
  router.get('/api/admin/auth/navigation', handler.navigation)
  router.get('/api/admin/menus', handler.list).post('/api/admin/menus', handler.create)
  router.get('/api/admin/menus/catalog', handler.catalog)
  router.put('/api/admin/roles/:id/authorization', roleHandler.assignRoleAuthorization)
  router.put('/api/admin/menus/:id/move', handler.move)
  router.put('/api/admin/menus/:id', handler.update).delete('/api/admin/menus/:id', handler.remove)
  router.get('/api/admin/roles/:id/menus', roleHandler.roleMenus)
  router.get('/api/admin/roles', roleHandler.list)
  app.use(router); server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const anonymous = await auth.bootstrap(undefined, meta); raw = (await auth.login(anonymous.raw, 'root', password, meta)).raw
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('动态菜单与后台导航', () => {
  it('授权仅接受联合提交，已退役单项接口默认拒绝', async () => {
    const role = await roles.create(root, {code: 'unified_entry_fixture', name: 'Unified', enabled: true}, meta)
    const menuId = String((await rowByCode('roles')).id)
    expect((await request(`roles/${role.id}/authorization`, 'PUT', {version: 1, permissions: ['system.roles.read'], menuIds: [menuId]})).status).toBe(200)
    expect((await request(`roles/${role.id}/permissions`, 'PUT', {version: 2, permissions: []})).status).toBe(403)
    expect((await request(`roles/${role.id}/menus`, 'PUT', {version: 2, menuIds: []})).status).toBe(403)
    expect(await roles.detail(root, role.id)).toMatchObject({version: 2, permissions: ['system.roles.read']})
    expect((await createRoleAuthorizationService(client.database).roleMenus(root, role.id)).menuIds).toEqual([menuId])
    expect((await request(`roles/${role.id}/authorization`, 'PUT', {version: 2, permissions: [], menuIds: []})).status).toBe(200)
    await roles.remove(root, role.id, {version: 3}, meta)
  })
  it('初始化网站运营与系统分组导航，重复同步保留自定义目录配置和空授权过滤', async () => {
    expect((await menus.navigation(root)).items.map(item => item.code)).toEqual(['site_maintenance','site_settings','site_header','site_footer','site_modules','site_languages','website_templates','website_routes','page_maintenance','website_home','website_about','website_investment','website_export','website_products','website_sustainability','website_news','website_careers','website_contact','news_center','news_articles','news_categories','careers_center','career_positions','inquiries_center','customer_inquiries','customer_inquiry_settings','customer_inquiry_mail_settings','account_access', 'users', 'roles', 'menus', 'system_config', 'parameters', 'dictionaries', 'scheduled_tasks', 'system_environment', 'logs_audit', 'login_logs', 'audit_logs', 'security_logs', 'media_library'])
    expect((await menus.navigation(empty)).items).toEqual([])
    const group = await rowByCode('system_config')
    try {
      await client.database.update(adminMenus).set({ name: 'custom', sortOrder: 12, visible: false }).where(eq(adminMenus.id, group.id))
      await rbac.sync(); await rbac.sync()
      expect(await rowByCode('system_config')).toMatchObject({ name: 'custom', sortOrder: 12, visible: false })
      expect((await client.database.select().from(adminMenus)).some(row => row.code === 'system')).toBe(false)
    } finally {
      await client.database.update(adminMenus).set({ name: group.name, sortOrder: group.sortOrder, visible: group.visible }).where(eq(adminMenus.id, group.id))
    }
  })
  it('页面与操作统一授权：依赖校验、原子保存、版本/越权和失败回滚', async () => {
    const target = await roles.create(root, { code: 'unified_target', name: 'Unified target', enabled: true }, meta)
    const menu = await rowByCode('roles'), menuId = String(menu.id)
    const requestBody = { version: 1, menuIds: [menuId], permissions: ['system.roles.read'] }
    expect((await request('roles/' + target.id + '/authorization', 'PUT', { ...requestBody, permissions: [] })).status).toBe(400)
    expect((await roles.detail(root, target.id)).version).toBe(1)
    expect((await createRoleAuthorizationService(client.database).roleMenus(root, target.id)).menuIds).toEqual([])
    expect((await request('roles/' + target.id + '/authorization', 'PUT', requestBody, raw, false)).status).toBe(403)
    expect((await request('roles/' + target.id + '/authorization', 'PUT', requestBody)).status).toBe(200)
    expect((await roles.detail(root, target.id)).permissions).toEqual(['system.roles.read'])
    expect((await createRoleAuthorizationService(client.database).roleMenus(root, target.id)).menuIds).toEqual([menuId])
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, requestBody, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
    // member 可分配菜单但没有分配操作权限，不能借联合入口添加权限。
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(member, target.id, { ...requestBody, version: 2, permissions: ['system.roles.read', 'system.menus.read'] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(empty, target.id, { ...requestBody, version: 2 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const audit = vi.spyOn(auditRepository, 'audit').mockImplementationOnce(async () => { throw new Error('unified audit failure') })
    try { await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, { version: 2, menuIds: [], permissions: [] }, meta)).rejects.toThrow('unified audit failure') } finally { audit.mockRestore() }
    expect((await roles.detail(root, target.id))).toMatchObject({ version: 2, permissions: ['system.roles.read'] })
    expect((await createRoleAuthorizationService(client.database).roleMenus(root, target.id)).menuIds).toEqual([menuId])
    // 不再接受取消菜单但保留对应操作权限的联合请求。
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(member, target.id, { version: 2, menuIds: [], permissions: ['system.roles.read'] }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(member, target.id, { version: 2, menuIds: [], permissions: [] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, { version: 2, menuIds: [], permissions: [] }, meta)
    expect((await roles.detail(root, target.id))).toMatchObject({ version: 3, permissions: [] })
    await createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, { version: 3, menuIds: [], permissions: ['system.dashboard.read'] }, meta)
    expect((await roles.detail(root, target.id)).permissions).toEqual(['system.dashboard.read'])
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, { version: 4, menuIds: [], permissions: ['system.logs.login.sources.read'] }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, { version: 4, menuIds: [], permissions: ['system.logs.sources.read'] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, { version: 4, menuIds: [], permissions: ['system.roles.write'] }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await roles.remove(root, target.id, { version: 4 }, meta)
  })
  it('同级移动原子更新、拒绝旧版本/跨级与越权；新增及改父级自动排末尾', async () => {
    const parent = await menus.create(root, directory('move_parent'), meta)
    const other = await menus.create(root, directory('move_other'), meta)
    const a = await menus.create(root, { ...directory('move_first', parent.id), sortOrder: 9999 }, meta)
    const b = await menus.create(root, { ...directory('move_second', parent.id), sortOrder: 0 }, meta)
    expect(b.sortOrder).toBeGreaterThan(a.sortOrder)
    const input = { version: b.version, neighborId: a.id, neighborVersion: a.version, direction: 'up' }
    expect((await request('menus/' + b.id + '/move', 'PUT', input)).status).toBe(200)
    expect((await menus.list(root)).filter(row => row.parentId === parent.id).map(row => row.id)).toEqual([b.id, a.id])
    await expect(menus.move(root, b.id, input, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
    const current = (await menus.list(root)).find(row => row.id === b.id)!
    await expect(menus.move(root, b.id, { ...input, version: current.version, neighborId: other.id }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(menus.move(empty, b.id, input, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const moved = await menus.update(root, other.id, { iconKey: 'folder', name: other.name, parentId: parent.id, sortOrder: 0, visible: true, version: other.version }, meta)
    expect((await menus.list(root)).filter(row => row.parentId === parent.id).at(-1)?.id).toBe(moved.id)
    const before = await menus.list(root)
    const first = before.find(row => row.id === b.id)!, next = before.find(row => row.id === a.id)!
    const audit = vi.spyOn(auditRepository, 'audit').mockImplementationOnce(async () => { throw new Error('move audit failure') })
    try { await expect(menus.move(root, first.id, { version: first.version, neighborId: next.id, neighborVersion: next.version, direction: 'down' }, meta)).rejects.toThrow('move audit failure') } finally { audit.mockRestore() }
    expect((await menus.list(root)).filter(row => row.parentId === parent.id)).toEqual(before.filter(row => row.parentId === parent.id))
    // 遗留同值顺序按 ID 排列，移动后必须真正反转，而非无效交换同值。
    await client.database.update(adminMenus).set({ sortOrder: 9999 }).where(eq(adminMenus.parentId, BigInt(parent.id)))
    const tied = (await menus.list(root)).filter(row => row.parentId === parent.id)
    await menus.move(root, tied[1]!.id, { version: tied[1]!.version, neighborId: tied[0]!.id, neighborVersion: tied[0]!.version, direction: 'up' }, meta)
    expect((await menus.list(root)).filter(row => row.parentId === parent.id)[0]?.id).toBe(tied[1]!.id)
    await client.database.update(adminMenus).set({ sortOrder: 9999 }).where(eq(adminMenus.parentId, BigInt(parent.id)))
    const last = await menus.create(root, directory('move_append', parent.id), meta)
    expect((await menus.list(root)).filter(row => row.parentId === parent.id).at(-1)?.id).toBe(last.id)
    for (const row of (await menus.list(root)).filter(row => row.parentId === parent.id)) await menus.remove(root, row.id, { version: row.version }, meta)
    await menus.remove(root, parent.id, { version: parent.version }, meta)
  })
  it('通用网页入口继续按菜单 code 区分，固定页面唯一约束不变', async () => {
    await expect(menus.create(root, { ...directory('duplicate_dashboard'), pageKey: 'dashboard' }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const parent = await menus.create(root, directory('website_test'), meta)
    const first = await menus.create(root, { ...directory('company_intro', parent.id), pageKey: 'website_page', name: '企业介绍' }, meta)
    const second = await menus.create(root, { ...directory('quality_assurance', parent.id), pageKey: 'website_page', name: '质量保障' }, meta)
    const role = await roles.create(root, { code: 'website_reader', name: '网页维护查看', enabled: true }, meta)
    try {
      expect((await menus.navigation(root)).items.find(item => item.id === first.id)?.path).toBe('/admin/website/company_intro')
      expect((await menus.navigation(root)).items.find(item => item.id === second.id)?.path).toBe('/admin/website/quality_assurance')
      expect((await menus.list(root)).find(item => item.id === first.id)).not.toHaveProperty('uniqueBindingKey')
      await expect(menus.create(root, { ...directory('duplicate_fixed'), pageKey: 'roles' }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(client.database.insert(adminMenus).values(await withEntityIds(client.database, 'admin_menus', { iconKey: 'folder', code: 'duplicate_fixed_sql', pageKey: 'roles', name: '重复固定页' }))).rejects.toThrow()
      await expect(menus.create(root, { ...directory(first.code), pageKey: 'website_page' }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(menus.create(root, { ...directory('unknown_editor'), pageKey: 'unknown_editor' }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      // Arbitrary menu creation does not create page data or grant page scopes.
      expect((await menus.navigation(empty)).items).toEqual([])
    } finally {
      await client.database.delete(adminUserRoles).where(eq(adminUserRoles.roleId, BigInt(role.id)))
      await roles.remove(root, role.id, { version: await roleVersion(BigInt(role.id)) }, meta)
      for(const menu of [first,second]){
       await expect(menus.remove(root,menu.id,{version:1},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
       await createWebsitePageDeletionService(client.database).remove(root,menu.code,{resourceId:null,version:1,stateVersion:1,publishedReleaseId:null,confirmation:menu.code},meta)
      }
      await menus.remove(root, parent.id, { version: 1 }, meta)
    }
  })
  it('BF-06 菜单授权投影提供页面查看权限，仅提示而不自动补授', async () => {
    const before = await roleRepository.permissionCodes(client.database, ownRole)
    const result = await createRoleAuthorizationService(client.database).roleMenus(root, String(ownRole))
    expect(result.items.find(item => item.pageKey === 'roles')).toMatchObject({ permission: 'system.roles.read' })
    expect(result.items.find(item => item.pageKey === null)).toMatchObject({ permission: null })
    expect(await roleRepository.permissionCodes(client.database, ownRole)).toEqual(before)
  })
  it('增量同步幂等，保留名称/层级/顺序/显示及角色授权，不自动授予新菜单', async () => {
    const menu = await rowByCode('roles'), before = await client.database.select().from(adminRoleMenus)
    await menus.update(root, String(menu.id), { iconKey: 'folder', name: 'Custom role menu', parentId: null, sortOrder: 7, visible: false, version: menu.version }, meta)
    await rbac.sync(); await rbac.sync()
    const after = await rowByCode('roles'); expect(after.name).toBe('Custom role menu'); expect(after.parentId).toBeNull(); expect(after.visible).toBe(false); expect(after.sortOrder).toBeGreaterThan(menu.sortOrder)
    expect(await client.database.select().from(adminRoleMenus)).toEqual(before)
    await menus.update(root, String(after.id), { iconKey: 'folder', name: '角色管理', parentId: String((await rowByCode('account_access')).id), sortOrder: 200, visible: true, version: after.version }, meta)
  })
  it('多角色菜单并集去重，同时要求操作权限，空目录不显示，Root 不依赖角色', async () => {
    const own = await menus.navigation(member)
    expect(own.items.map(item => item.code)).toEqual(['account_access', 'roles'])
    expect((await menus.navigation(empty)).items).toEqual([])
    expect((await menus.navigation(root)).items.map(item => item.code)).toEqual(['site_maintenance','site_settings','site_header','site_footer','site_modules','site_languages','website_templates','website_routes','page_maintenance','website_home','website_about','website_investment','website_export','website_products','website_sustainability','website_news','website_careers','website_contact','news_center','news_articles','news_categories','careers_center','career_positions','inquiries_center','customer_inquiries','customer_inquiry_settings','customer_inquiry_mail_settings','account_access', 'users', 'menus', 'roles', 'system_config', 'parameters', 'dictionaries', 'scheduled_tasks', 'system_environment', 'logs_audit', 'login_logs', 'audit_logs', 'security_logs', 'media_library'])
    const other = await roles.create(root, { code: 'other_menu_role', name: 'Other', enabled: true }, meta)
    await setRoleMenus(client.database, root, other.id, { version: 1, menuIds: [String((await rowByCode('roles')).id), String((await rowByCode('menus')).id)] }, meta)
    await client.database.insert(adminUserRoles).values({ userId: member, roleId: BigInt(other.id) })
    expect((await menus.navigation(member)).items.map(item => item.code)).toEqual(['account_access', 'menus', 'roles'])
    const permission = (await client.database.select().from(adminPermissions).where(eq(adminPermissions.code, 'system.menus.read')))[0]!
    await client.database.delete(adminRolePermissions).where(eq(adminRolePermissions.permissionId, permission.id))
    expect((await menus.navigation(member)).items.some(item => item.code === 'menus')).toBe(false)
    await client.database.insert(adminRolePermissions).values({ roleId: ownRole, permissionId: permission.id })
    await client.database.delete(adminUserRoles).where(eq(adminUserRoles.roleId, BigInt(other.id)))
    await roles.remove(root, other.id, { version: 2 }, meta)
    expect((await client.database.select().from(adminRoleMenus).where(eq(adminRoleMenus.roleId, BigInt(other.id))))).toEqual([])
  })
  it('隐藏菜单/父级不阻止合法直达；代码禁用功能仍在服务端拒绝 Root', async () => {
    const before = await menus.navigation(member), menu = await rowByCode('account_access')
    await menus.update(root, String(menu.id), { iconKey: 'folder', name: menu.name, parentId: null, sortOrder: menu.sortOrder, visible: false, version: menu.version }, meta)
    expect((await menus.navigation(member)).items).toEqual([]); expect((await menus.navigation(member)).version).not.toBe(before.version)
    expect((await request('roles')).status).toBe(200)
    const previous = rbac
    try { rbac = createRbacService(client.database, permissionCatalog, adminRoutePolicies.map(policy => policy.path === '/api/admin/roles' && policy.method === 'GET' ? { ...policy, enabled: false } : policy)); expect((await request('roles')).status).toBe(403) } finally { rbac = previous }
    await menus.update(root, String(menu.id), { iconKey: 'folder', name: menu.name, parentId: null, sortOrder: menu.sortOrder, visible: true, version: menu.version + 1 }, meta)
  })
  it('拒绝自引用、循环、非目录父级、未知页面、任意路径和越界层级', async () => {
    const a = await menus.create(root, directory('tree_a'), meta), b = await menus.create(root, directory('tree_b', a.id), meta)
    await expect(menus.update(root, a.id, { iconKey: 'folder', name: a.name, parentId: b.id, sortOrder: 1, visible: true, version: 1 }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(menus.update(root, a.id, { iconKey: 'folder', name: a.name, parentId: a.id, sortOrder: 1, visible: true, version: 1 }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(menus.create(root, directory('invalid_parent', String((await rowByCode('roles')).id)), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(menus.create(root, { ...directory('unknown_page'), pageKey: 'news' }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(menus.create(root, { ...directory('external_link'), path: 'https://external.test' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    let parent = b.id
    for (let i = 3; i <= 8; i++) parent = (await menus.create(root, directory(`depth_${i}`, parent), meta)).id
    await expect(menus.create(root, directory('depth_nine', parent), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('普通管理员菜单授权限于自己已有且有页面权限的菜单，不能扩权', async () => {
    const target = await roles.create(root, { code: 'grant_menu_target', name: 'Target', enabled: true }, meta), roleMenu = String((await rowByCode('roles')).id), menuMenu = String((await rowByCode('menus')).id)
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(member, target.id, {version: 1, menuIds: [menuMenu], permissions: await roleRepository.permissionCodes(client.database, BigInt(target.id))}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setRoleMenus(client.database, member, target.id, { version: 1, menuIds: [roleMenu] }, meta)
    expect((await roles.detail(root, target.id)).permissions).toEqual([])
    await setRoleMenus(client.database, root, target.id, { version: 2, menuIds: [menuMenu] }, meta)
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(member, target.id, {version: 3, menuIds: [], permissions: await roleRepository.permissionCodes(client.database, BigInt(target.id))}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(root, target.id, {version: 3, menuIds: [String((await rowByCode('account_access')).id)], permissions: await roleRepository.permissionCodes(client.database, BigInt(target.id))}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('有子菜单/角色引用不能删除；无引用删除不禁用 API；唯一约束和乐观锁', async () => {
    const parent = await rowByCode('tree_a')
    await expect(menus.remove(root, String(parent.id), { version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'REFERENCED' })
    const roleMenu = await rowByCode('roles')
    await expect(menus.remove(root, String(roleMenu.id), { version: roleMenu.version }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
    const a = await menus.create(root, directory('removable_menu'), meta)
    await expect(menus.create(root, directory('removable_menu'), meta)).rejects.toMatchObject({ code: 'CONFLICT' })
    await menus.update(root, a.id, { iconKey: 'folder', name: 'Updated', parentId: null, sortOrder: 1, visible: true, version: 1 }, meta)
    await expect(menus.update(root, a.id, { iconKey: 'folder', name: 'Stale', parentId: null, sortOrder: 1, visible: true, version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
    await menus.remove(root, a.id, { version: 2 }, meta)
    expect((await menus.list(root)).some(row => row.id === a.id)).toBe(false)
    expect((await request('roles')).status).toBe(200)
  })
  it('并发互相移动只允许一个成功，不产生循环', async () => {
    const a = await menus.create(root, directory('move_a'), meta), b = await menus.create(root, directory('move_b'), meta)
    const results = await Promise.allSettled([[a, b], [b, a]].map(([from, to]) => menus.update(root, from!.id, { iconKey: 'folder', name: from!.name, parentId: to!.id, sortOrder: 1, visible: true, version: 1 }, meta)))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect((await menus.list(root)).length).toBeGreaterThan(0)
  })
  it('成功审计失败回滚菜单和角色授权，失败日志不保存对象或凭据', async () => {
    const row = await menus.create(root, directory('audit_target'), meta)
    const audit = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit fixture failure'))
    try { await expect(menus.update(root, row.id, { iconKey: 'folder', name: 'After', parentId: null, sortOrder: 2, visible: false, version: 1 }, meta)).rejects.toThrow('audit fixture failure') } finally { audit.mockRestore() }
    expect((await menus.list(root)).find(item => item.id === row.id)).toMatchObject({ name: row.name, version: 1, visible: true })
    const auditRole = await roles.create(root, {code: 'audit_grants_fixture', name: 'Audit grants', enabled: true}, meta)
    const menuId = String((await rowByCode('roles')).id)
    const authorization = createRoleAuthorizationService(client.database)
    await authorization.assignRoleAuthorization(root, auditRole.id, {version: 1, permissions: ['system.roles.read'], menuIds: [menuId]}, meta)
    const before = await authorization.roleMenus(root, auditRole.id), roleAudit = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('role audit failure'))
    try { await expect(authorization.assignRoleAuthorization(root, auditRole.id, {version: before.version, menuIds: before.menuIds, permissions: await roleRepository.permissionCodes(client.database, BigInt(auditRole.id))}, meta)).rejects.toThrow('role audit failure') } finally { roleAudit.mockRestore() }
    expect((await authorization.roleMenus(root, auditRole.id)).menuIds).toEqual(before.menuIds)
    expect(await roleVersion(BigInt(auditRole.id))).toBe(before.version)
    await roles.remove(root, auditRole.id, {version: before.version}, meta)
    const logs = await client.database.select().from(adminOperationLogs)
    expect(logs.some(log => log.action === 'menus.update' && log.result === 'failed')).toBe(true)
    const text = JSON.stringify(logs, (_, value) => typeof value === 'bigint' ? String(value) : value)
    expect(text).not.toContain(password); expect(text).not.toContain(raw)
    expect(logs.filter(log => log.result === 'failed').every(log => log.changeContext === null)).toBe(true)
    expect(JSON.stringify(logs.filter(log => log.result === 'failed'), (_, value) => typeof value === 'bigint' ? String(value) : value)).not.toContain('pageKey')
  })
  it('菜单维护检查受影响页面权限，角色菜单写入不能管理更高权限角色', async () => {
    await expect(menus.create(empty, directory('unauthorized_menu'), meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const target = await roles.create(root, { code: 'broad_menu_role', name: 'Broad', enabled: true }, meta)
    await setRolePermissions(client.database, root, target.id, { version: 1, permissions: ['system.roles.delete'] }, meta)
    const menu = await rowByCode('roles')
    await expect(createRoleAuthorizationService(client.database).assignRoleAuthorization(member, target.id, {version: 2, menuIds: [String(menu.id)], permissions: await roleRepository.permissionCodes(client.database, BigInt(target.id))}, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const permission = (await client.database.select().from(adminPermissions).where(eq(adminPermissions.code, 'system.roles.read')))[0]!
    await client.database.delete(adminRolePermissions).where(and(eq(adminRolePermissions.roleId, ownRole), eq(adminRolePermissions.permissionId, permission.id)))
    try {
      await expect(menus.update(member, String(menu.id), { iconKey: 'folder', name: menu.name, parentId: menu.parentId === null ? null : String(menu.parentId), sortOrder: menu.sortOrder, visible: false, version: menu.version }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    } finally { await client.database.insert(adminRolePermissions).values({ roleId: ownRole, permissionId: permission.id }) }
  })
  it('真实 HTTP 管理入口、CSRF、Zod、路径白名单和同 Session 撤权即时生效', async () => {
    expect((await fetch(base + '/api/admin/auth/navigation')).status).toBe(401)
    expect((await request('menus')).status).toBe(200); expect((await request('menus/catalog')).status).toBe(200)
    expect((await request('menus', 'POST', directory('http_menu'), raw, false)).status).toBe(403)
    expect((await request('menus', 'POST', { ...directory('http_menu'), parentId: 'evil' })).status).toBe(400)
    const response = await request('menus', 'POST', directory('http_menu')); expect(response.status).toBe(200)
    const { data: created } = await response.json()
    expect((await request(`menus/${created.id}`, 'PUT', { iconKey: 'folder', name: 'HTTP Updated', parentId: null, sortOrder: 2, visible: true, version: 1 })).status).toBe(200)
    expect((await request(`menus/${created.id}`, 'DELETE', { version: 1 })).status).toBe(409)
    expect((await request(`menus/${created.id}`, 'DELETE', { version: 2 })).status).toBe(200)
    for (const path of ['menus/01', 'menus/1/extra', 'roles/1/menus/extra']) expect((await request(path, 'PUT', {})).status).toBe(403)
    const anonymous = await auth.bootstrap(undefined, meta), token = (await auth.login(anonymous.raw, 'menu_member', password, meta)).raw
    expect((await (await request('auth/navigation', 'GET', undefined, token)).json()).data.items.some((item: { code: string }) => item.code === 'roles')).toBe(true)
    const before = await createRoleAuthorizationService(client.database).roleMenus(root, String(ownRole))
    expect((await request(`roles/${ownRole}/authorization`, 'PUT', { version: before.version, menuIds: [], permissions: [] })).status).toBe(200)
    expect((await (await request('auth/navigation', 'GET', undefined, token)).json()).data.items).toEqual([])
    expect((await request('roles', 'GET', undefined, token)).status).toBe(403)
  })
  it('同步尊重深层目录配置，缺失系统页面不会被补到非法第九层', async () => {
    for (const row of (await client.database.select().from(adminMenus)).filter(item => item.pageKey !== null)) {
      await menus.update(root, String(row.id), { iconKey: 'folder', name: row.name, parentId: null, sortOrder: row.sortOrder, visible: row.visible, version: row.version }, meta)
    }
    const system = await rowByCode('account_access'), deep = await rowByCode('depth_7')
    await menus.update(root, String(system.id), { iconKey: 'folder', name: system.name, parentId: String(deep.id), sortOrder: system.sortOrder, visible: system.visible, version: system.version }, meta)
    const menu = await rowByCode('menus')
    await client.database.delete(adminRoleMenus).where(eq(adminRoleMenus.menuId, menu.id))
    await menus.remove(root, String(menu.id), { version: menu.version }, meta)
    await rbac.sync()
    expect((await rowByCode('account_access')).parentId).toBe(deep.id)
    expect((await rowByCode('menus')).parentId).toBeNull()
    expect((await menus.list(root)).length).toBeGreaterThan(0)
  })

})
