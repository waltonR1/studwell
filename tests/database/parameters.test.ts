import {setRolePermissions} from './authorization-fixture'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { auditRepository } from '../../server/repositories/audit'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import {createParameterService} from '../../server/services/parameters'
import {resolveListPageSize} from '../../server/services/parameter-values'
import { createUserService } from '../../server/services/users'
import { createRoleService } from '../../server/services/roles'
import { createRbacService } from '../../server/services/rbac'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { adminParameters, adminUsers, adminUserRoles, adminOperationLogs } from '../../server/db/schema'
import { parameterRepository } from '../../server/repositories/parameters'
import { listPageSizeDefinition } from '../../server/config/parameters'
import { parameterHandlers } from '../../server/http/handlers/parameter-handlers'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, reader: bigint, writer: bigint, role: string, server: Server, base: string, raw: string, readerRaw: string
let service: ReturnType<typeof createParameterService>
const password = 'Parameter fixture Aurora 8412!', meta = { ip: '127.0.0.1', userAgent: 'parameter-fixture', requestId: '00000000-0000-4000-8000-000000000001' }, options = { origin: 'http://parameters.test', secureCookie: false }
const current = () => parameterRepository.find(client.database, listPageSizeDefinition.key)
async function save(value: number | null, actor = root) { const row = (await current())!; return service.update(actor, String(row.id), { version: row.version, value }, meta) }
async function request(path: string, method = 'GET', body?: object, csrf = true, token = raw) { return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'X-CSRF-Token': csrf ? csrfToken(token) : 'bad', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  const accounts = createAccountService(client.database, false)
  reader = BigInt((await accounts.createOrdinary({ username: 'parameter_reader', displayName: 'Reader', password }, String(root))).id)
  writer = BigInt((await accounts.createOrdinary({ username: 'parameter_writer', displayName: 'Writer', password }, String(root))).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  const rbac = createRbacService(client.database); await rbac.sync()
  const roles = createRoleService(client.database)
  role = (await roles.create(root, { code: 'parameter_read_role', name: '参数只读', enabled: true }, meta)).id
  await setRolePermissions(client.database, root, role, { version: 1, permissions: ['system.parameters.read'] }, meta)
  await client.database.insert(adminUserRoles).values({ userId: reader, roleId: BigInt(role) })
  const writeRole = (await roles.create(root, { code: 'parameter_write_role', name: '参数写入', enabled: true }, meta)).id
  await setRolePermissions(client.database, root, writeRole, { version: 1, permissions: ['system.parameters.update'] }, meta)
  await client.database.insert(adminUserRoles).values({ userId: writer, roleId: BigInt(writeRole) })
  service = createParameterService(client.database)
  const auth = createAuthService(client.database, undefined, false), anon = await auth.bootstrap(undefined, meta)
  raw = (await auth.login(anon.raw, 'root', password, meta)).raw
  const readerAnon = await auth.bootstrap(undefined, meta); readerRaw = (await auth.login(readerAnon.raw, 'parameter_reader', password, meta)).raw
  const app = createApp(), router = createRouter(), handlers = parameterHandlers(client.database, options)
  app.use(defineEventHandler(async event => { ensureRequestId(event); try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) } }))
  router.get('/api/admin/parameters', handlers.list).put('/api/admin/parameters/:id', handlers.update).get('/api/admin/auth/preferences', handlers.preferences)
  app.use(router); server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('系统参数纵向交付', () => {
  it('迁移默认值、更新、元数据、恢复默认和版本检查', async () => {
    const [initial] = await service.list(root); expect(initial).toMatchObject({ value: 20, override: null, version: 1, editable: true, type: 'number' })
    const before = await service.preferences(reader)
    expect(await service.preferences(reader, before.version)).toEqual({ changed: false, version: before.version })
    const updated = await save(50); expect(updated).toMatchObject({ value: 50, override: 50, version: 2, updatedBy: String(root) })
    const after = await service.preferences(reader, before.version); expect(after).toMatchObject({ changed: true, pageSize: 50 }); expect(after.version).not.toBe(before.version)
    expect(await save(null)).toMatchObject({ value: 20, override: null, version: 3 })
  })
  it('管理权限独立、只读不能写、普通账号仅获取安全偏好、撤权立即生效', async () => {
    expect((await request('parameters', 'GET', undefined, true, readerRaw)).status).toBe(200)
    const row = (await current())!
    expect((await request(`parameters/${row.id}`, 'PUT', { version: row.version, value: 50 }, true, readerRaw)).status).toBe(403)
    await expect(service.list(writer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(save(10, reader)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await save(10, writer); expect(await service.preferences(reader)).toMatchObject({ pageSize: 10 })
    await setRolePermissions(client.database, root, role, { version: 2, permissions: [] }, meta)
    await expect(service.list(reader)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await request('parameters', 'GET', undefined, true, readerRaw)).status).toBe(403)
    expect((await request('auth/preferences', 'GET', undefined, true, readerRaw)).status).toBe(200)
    const preferences = await service.preferences(reader); expect(Object.keys(preferences).sort()).toEqual(['changed', 'pageSize', 'version'])
    await save(null)
  })
  it('非法类型、定义注入、未知目标及过期版本拒绝且无值泄露', async () => {
    const row = (await current())!
    for (const value of ['50', 30, 100, true]) await expect(service.update(root, String(row.id), { version: row.version, value }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.update(root, String(row.id), { version: row.version, value: 10, key: 'password' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.update(root, '999999', { version: row.version, value: 10 }, meta)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.update(root, String(row.id), { version: row.version + 1, value: 10 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
  })
  it('同时保存只有一个成功，审计失败回滚值、版本及修改人', async () => {
    const row = (await current())!
    const results = await Promise.allSettled([10, 50].map(value => service.update(root, String(row.id), { version: row.version, value }, meta)))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } })
    const before = await current(), spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit failure'))
    try { await expect(save(20, writer)).rejects.toThrow('audit failure') } finally { spy.mockRestore() }
    expect(await current()).toEqual(before)
    const logs = await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.targetType, 'parameter'))
    expect(logs.some(log => log.result === 'success')).toBe(true); expect(logs.some(log => log.result === 'failed')).toBe(true)
    expect(JSON.stringify(logs, (_key, value) => typeof value === 'bigint' ? String(value) : value)).not.toContain(password); expect(JSON.stringify(logs, (_key, value) => typeof value === 'bigint' ? String(value) : value)).not.toContain('parameter_value')
    await save(null)
  })
  it('服务端每次读取最新默认值，显式分页优先且保留溢出校验', async () => {
    const users = createUserService(client.database, false), roles = createRoleService(client.database)
    await save(50)
    expect((await users.list(root, {})).pageSize).toBe(50); expect((await roles.list(root, {})).pageSize).toBe(50)
    expect((await users.list(root, { pageSize: '10' })).pageSize).toBe(10); expect((await roles.list(root, { pageSize: '20' })).pageSize).toBe(20)
    for (const list of [users.list, roles.list]) { await expect(list(root, { pageSize: '100' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }); await expect(list(root, { page: '300000000000000' })).rejects.toMatchObject({ code: 'INVALID_INPUT' }) }
    await save(null)
  })
  it('数据库非法覆盖值安全回退，可通过恢复默认修复；未知键不开放', async () => {
    await client.database.update(adminParameters).set({ value: 'secret-invalid' }).where(eq(adminParameters.key, listPageSizeDefinition.key))
    expect(await resolveListPageSize(client.database)).toBe(20)
    expect((await service.list(root))[0]).toMatchObject({ invalidOverride: true, value: 20, override: null })
    expect(JSON.stringify(await service.list(root))).not.toContain('secret-invalid')
    await client.database.insert(adminParameters).values(await withEntityIds(client.database, 'admin_parameters', { key: 'unknown.secret', defaultValue: 'null', value: 'hidden' }))
    expect(await service.list(root)).toHaveLength(28)
    expect(await save(null)).toMatchObject({ invalidOverride: false, value: 20 })
  })
  it('首次改密、禁用账号不能读取本人偏好', async () => {
    try {
      await client.database.update(adminUsers).set({ mustChangePassword: true }).where(eq(adminUsers.id, reader))
      expect((await request('auth/preferences', 'GET', undefined, true, readerRaw)).status).toBe(403)
      await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: false }).where(eq(adminUsers.id, reader))
      expect((await request('auth/preferences', 'GET', undefined, true, readerRaw)).status).toBe(401)
    } finally { await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: true }).where(eq(adminUsers.id, reader)) }
  })
  it('真实 HTTP：协议、CSRF、严格路径/方法/Zod、偏好版本响应', async () => {
    let response = await request('parameters'); expect(response.status).toBe(200)
    const [row] = (await response.json()).data
    expect((await request(`parameters/${row.id}`, 'PUT', { version: row.version, value: 50 }, false)).status).toBe(403)
    expect((await request(`parameters/${row.id}`, 'PUT', { version: row.version, value: '50' })).status).toBe(400)
    expect((await request(`parameters/${row.id}`, 'PUT', { version: row.version, value: 50 })).status).toBe(200)
    expect((await request(`parameters/${row.id}`, 'PUT', { version: row.version, value: 20 })).status).toBe(409)
    expect((await request('parameters', 'POST', {})).status).toBe(403)
    expect((await request(`parameters/${row.id}/extra`, 'PUT', {})).status).toBe(403)
    expect((await request('parameters?unknown=x')).status).toBe(400)
    response = await request('auth/preferences'); const data = (await response.json()).data; expect(data).toMatchObject({ changed: true, pageSize: 50 })
    response = await request(`auth/preferences?version=${data.version}`); expect((await response.json()).data).toEqual({ changed: false, version: data.version })
    expect((await request('auth/preferences?version=x&version=y')).status).toBe(400)
    await save(null)
  })
})
