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
import { createDictionaryService, resolveDictionaryItem, requireActiveDictionaryItem } from '../../server/services/dictionaries'
import { createRoleService } from '../../server/services/roles'
import { createParameterService } from '../../server/services/parameters'
import { createRbacService } from '../../server/services/rbac'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { dictionaryRepository } from '../../server/repositories/dictionaries'
import { adminUsers, adminUserRoles, adminDictionaries, adminDictionaryItems, adminOperationLogs } from '../../server/db/schema'
import { dictionaryHandlers } from '../../server/http/handlers/dictionary-handlers'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, reader: bigint, writer: bigint, consumer: bigint, readRole: string, server: Server, base: string, rootRaw: string, readerRaw: string, consumerRaw: string
let service: ReturnType<typeof createDictionaryService>
const password = 'Dictionary fixture Aurora 84127!', meta = { ip: '127.0.0.1', userAgent: 'dictionary-fixture', requestId: '00000000-0000-4000-8000-000000000001' }, options = { origin: 'http://dictionaries.test', secureCookie: false }
const fields = (name: string) => ({ name, description: '', enabled: true })
async function create(code: string) { return service.create(root, { code, ...fields(code) }, meta) }
async function active(dictionaryId: string, itemId: string) { return client.database.transaction(tx => requireActiveDictionaryItem(tx, dictionaryId, itemId)) }
async function add(id: string, code: string, sortOrder = 0, enabled = true, actor = root) { const row = await dictionaryRepository.find(client.database, BigInt(id)); return service.createItem(actor, id, { code, name: code, sortOrder, enabled, version: row!.version }, meta) }
async function request(path: string, method = 'GET', body?: object, token = rootRaw, csrf = true) { return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'X-CSRF-Token': csrf ? csrfToken(token) : 'bad', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  const accounts = createAccountService(client.database, false)
  reader = BigInt((await accounts.createOrdinary({ username: 'dictionary_reader', displayName: 'Reader', password }, String(root))).id)
  writer = BigInt((await accounts.createOrdinary({ username: 'dictionary_writer', displayName: 'Writer', password }, String(root))).id)
  consumer = BigInt((await accounts.createOrdinary({ username: 'dictionary_consumer', displayName: 'Consumer', password }, String(root))).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  const rbac = createRbacService(client.database); await rbac.sync()
  const roles = createRoleService(client.database)
  for (const [code, user, permissions] of [['dictionary_read_role', reader, ['system.dictionaries.read']], ['dictionary_write_role', writer, ['system.dictionaries.items.create', 'system.dictionaries.items.update']], ['dictionary_options_role', consumer, ['system.dictionaries.read']]] as const) {
    const role = await roles.create(root, { code, name: code, enabled: true }, meta)
    await setRolePermissions(client.database, root, role.id, { version: 1, permissions: [...permissions] }, meta)
    await client.database.insert(adminUserRoles).values({ userId: user, roleId: BigInt(role.id) })
    if (user === reader) readRole = role.id
  }
  service = createDictionaryService(client.database)
  const auth = createAuthService(client.database, undefined, false)
  async function login(username: string) { const anonymous = await auth.bootstrap(undefined, meta); return (await auth.login(anonymous.raw, username, password, meta)).raw }
  rootRaw = await login('root'); readerRaw = await login('dictionary_reader'); consumerRaw = await login('dictionary_consumer')
  const app = createApp(), router = createRouter(), handlers = dictionaryHandlers(client.database, options)
  app.use(defineEventHandler(async event => { ensureRequestId(event); try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) } }))
  router.get('/api/admin/dictionaries', handlers.list).post('/api/admin/dictionaries', handlers.create)
  router.get('/api/admin/dictionaries/:id', handlers.detail).put('/api/admin/dictionaries/:id', handlers.update)
  router.post('/api/admin/dictionaries/:id/items', handlers.createItem).get('/api/admin/dictionaries/:id/options', handlers.options)
  router.put('/api/admin/dictionary-items/:id', handlers.updateItem)
  app.use(router); server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('字典纵向交付', () => {
  it('只预置部门岗位两个接入类型，CRUD元数据、唯一和固定分页', async () => {
    const seeded = await service.list(root, {})
    expect(seeded.total).toBe(2)
    expect(seeded.items.map(item => item.code)).toEqual(['account_position', 'account_department'])
    expect(seeded.items.every(item => item.optionCount === 0 && item.enabledOptionCount === 0)).toBe(true)
    const first = await create('dictionary_first'); expect(first).toMatchObject({ version: 1, createdBy: String(root), updatedBy: String(root), items: [] })
    await expect(create('dictionary_first')).rejects.toMatchObject({ code: 'CONFLICT', reason: 'DUPLICATE' })
    await expect(create('Dictionary_First')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await service.update(root, first.id, { ...fields('Changed'), enabled: false, version: 1 }, meta)
    expect((await service.list(root, { search: 'dictionary_first', status: 'disabled' })).items[0]).toMatchObject({ name: 'Changed', enabled: false, version: 2 })
    expect((await service.list(root, { search: '%' })).total).toBe(0)
    await expect(service.list(root, { sort: 'name' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const parameters = createParameterService(client.database), [parameter] = await parameters.list(root)
    await parameters.update(root, parameter!.id, { version: parameter!.version, value: 50 }, meta)
    expect((await service.list(root, {})).pageSize).toBe(50); expect((await service.list(root, { pageSize: '10' })).pageSize).toBe(10)
    await expect(service.list(root, { page: '300000000000000' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await parameters.update(root, parameter!.id, { version: parameter!.version + 1, value: null }, meta)
  })
  it('稳定编码、跨字典唯一/归属保护和选项排序', async () => {
    const row = await create('dictionary_order'), other = await create('dictionary_other')
    await add(row.id, 'option_later', 20); let result = await add(row.id, 'option_first', 10)
    expect(result.items.map(item => item.code)).toEqual(['option_first', 'option_later']); expect(result.version).toBe(3)
    const listed = await service.list(root, { search: 'dictionary_order' })
    expect(listed.items[0]).toMatchObject({ optionCount: 2, enabledOptionCount: 2 })
    await expect(add(row.id, 'option_first')).rejects.toMatchObject({ code: 'CONFLICT' })
    await add(other.id, 'option_first')
    const item = result.items[0]!
    await expect(service.update(root, row.id, { ...fields('Renamed'), version: result.version, code: 'changed' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.updateItem(root, item.id, { dictionaryId: row.id, version: result.version, name: 'Changed', sortOrder: 1, enabled: true, code: 'changed' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.updateItem(root, item.id, { dictionaryId: other.id, version: 2, name: 'Changed', sortOrder: 1, enabled: true }, meta)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    result = await service.updateItem(root, item.id, { dictionaryId: row.id, version: result.version, name: '新标签', sortOrder: 25, enabled: true }, meta)
    expect(result.items.map(item => item.code)).toEqual(['option_later', 'option_first']); expect(result.items[1]).toMatchObject({ id: item.id, name: '新标签', updatedBy: String(root) })
  })
  it('禁用过滤、版本协商、历史名称解析及新增选择校验', async () => {
    const parent = await create('dictionary_effective'); let row = await add(parent.id, 'active_option')
    row = await add(row.id, 'disabled_option', 0, false)
    const active = row.items.find(item => item.code === 'active_option')!, disabled = row.items.find(item => item.code === 'disabled_option')!
    const before = await service.options(consumer, row.id); expect(before).toMatchObject({ changed: true, items: [{ id: active.id, code: 'active_option', name: 'active_option' }] })
    expect(await service.options(consumer, row.id, before.version)).toEqual({ changed: false, version: before.version })
    expect(await client.database.transaction(tx => requireActiveDictionaryItem(tx, row.id, active.id))).toMatchObject({ code: 'active_option' })
    await expect(client.database.transaction(tx => requireActiveDictionaryItem(tx, row.id, disabled.id))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    row = await service.update(root, row.id, { ...fields(row.name), enabled: false, version: row.version }, meta)
    expect(await service.options(consumer, row.id, before.version)).toMatchObject({ changed: true, dictionary: { enabled: false }, items: [] })
    expect(await resolveDictionaryItem(client.database, row.id, disabled.id)).toMatchObject({ id: disabled.id, name: 'disabled_option', enabled: false, dictionaryEnabled: false })
    await expect(client.database.transaction(tx => requireActiveDictionaryItem(tx, row.id, active.id))).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    row = await service.update(root, row.id, { ...fields(row.name), enabled: true, version: row.version }, meta)
    expect(await service.options(consumer, row.id)).toMatchObject({ items: [{ id: active.id }] })
    await expect(resolveDictionaryItem(client.database, row.id, '999999')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('选项读取沿用字典页面权限，只读不能写入，结果不含管理元数据', async () => {
    const row = await create('dictionary_permissions')
    await expect(service.create(reader, { code: 'reader_forbidden', ...fields('x') }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.update(writer, row.id, { ...fields('x'), version: 1 }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(add(row.id, 'reader_forbidden', 0, true, reader)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.options(writer, row.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await service.options(reader, row.id)).toMatchObject({ changed: true })
    const result = await add(row.id, 'writer_allowed', 0, true, writer)
    expect(result.version).toBe(2)
    const response = await service.options(consumer, row.id)
    expect(JSON.stringify(response)).not.toContain('createdBy'); expect(JSON.stringify(response)).not.toContain('description')
  })
  it('业务事务已有旧快照时，新增引用仍拒绝刚禁用的选项', async () => {
    const parent = await create('dictionary_current_read'), row = await add(parent.id, 'current_read_option'), item = row.items[0]!
    await client.database.transaction(async tx => {
      expect((await dictionaryRepository.snapshot(tx, BigInt(row.id)))!.items[0]!.enabled).toBe(true)
      await service.updateItem(root, item.id, { dictionaryId: row.id, version: row.version, name: item.name, sortOrder: item.sortOrder, enabled: false }, meta)
      await expect(requireActiveDictionaryItem(tx, row.id, item.id)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    })
    await expect(active(row.id, item.id)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('共享版本拒绝过期类型/选项写入，并发父子修改仅一个成功', async () => {
    const row = await create('dictionary_concurrent')
    const results = await Promise.allSettled([service.update(root, row.id, { ...fields('Updated'), version: 1 }, meta), service.createItem(root, row.id, { code: 'concurrent_item', name: 'New', sortOrder: 0, enabled: true, version: 1 }, meta)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } })
    await expect(service.update(root, row.id, { ...fields('Stale'), version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' })
    await expect(service.createItem(root, row.id, { code: 'stale_item', name: 'Stale', sortOrder: 0, enabled: true, version: 1 }, meta)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
  it('审计失败回滚创建、类型、选项及共享版本，不存对象快照', async () => {
    const row = await create('dictionary_rollback'); const result = await add(row.id, 'rollback_item')
    const before = await service.detail(root, row.id), item = result.items[0]!
    for (const work of [() => create('rollback_failed_create'), () => service.update(root, row.id, { ...fields('Rejected'), version: before.version }, meta), () => add(row.id, 'rollback_failed_item'), () => service.updateItem(root, item.id, { dictionaryId: row.id, version: before.version, name: 'Rejected', sortOrder: 9, enabled: false }, meta)]) {
      const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit failure'))
      try { await expect(work()).rejects.toThrow('audit failure') } finally { spy.mockRestore() }
      expect(await service.detail(root, row.id)).toEqual(before)
    }
    expect((await service.list(root, { search: 'rollback_failed_create' })).total).toBe(0)
    const logs = await client.database.select().from(adminOperationLogs)
    expect(logs.some(log => log.action === 'dictionaries.items.create' && log.result === 'success')).toBe(true)
    expect(logs.some(log => log.action === 'dictionaries.items.update' && log.result === 'failed')).toBe(true)
    const serialized = JSON.stringify(logs, (_key, value) => typeof value === 'bigint' ? String(value) : value)
    expect(serialized).not.toContain(password)
    const failed = logs.filter(log => log.result === 'failed')
    expect(failed.every(log => log.changeContext === null)).toBe(true)
    const failedText = JSON.stringify(failed, (_, value) => typeof value === 'bigint' ? String(value) : value)
    expect(failedText).not.toContain('description'); expect(failedText).not.toContain('sortOrder')
  })
  it('真实外键/编码约束、500项上限和查询索引', async () => {
    const row = await create('dictionary_capacity')
    await expect(client.database.insert(adminDictionaryItems).values(await withEntityIds(client.database, 'admin_dictionary_items', { dictionaryId: 999999n, code: 'orphan_item', name: 'Orphan' }))).rejects.toThrow()
    await expect(client.database.insert(adminDictionaries).values(await withEntityIds(client.database, 'admin_dictionaries', { code: 'UpperCase', name: 'Invalid' }))).rejects.toThrow()
    await client.database.insert(adminDictionaryItems).values(await withEntityIds(client.database, 'admin_dictionary_items', Array.from({ length: 500 }, (_, index) => ({ dictionaryId: BigInt(row.id), code: `capacity_${index}`, name: `Item ${index}` }))))
    await expect(add(row.id, 'overflow_item')).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await service.detail(root, row.id)).version).toBe(1)
    await expect(client.database.delete(adminDictionaries).where(eq(adminDictionaries.id, BigInt(row.id)))).rejects.toThrow()
    const [plan] = await client.pool.query('EXPLAIN SELECT id FROM admin_dictionary_items WHERE dictionary_id=? ORDER BY sort_order, id', [row.id])
    expect(JSON.stringify(plan)).toContain('admin_dictionary_items_order')
  })
  it('实际HTTP CRUD/CSRF/Zod/409/无删除及同Session撤权', async () => {
    expect((await request('dictionaries', 'POST', { code: 'http_dictionary', ...fields('HTTP') }, rootRaw, false)).status).toBe(403)
    let response = await request('dictionaries', 'POST', { code: 'http_dictionary', ...fields('HTTP') }); expect(response.status).toBe(200)
    const row = (await response.json()).data
    expect((await request('dictionaries', 'GET', undefined, readerRaw)).status).toBe(200)
    expect((await request('dictionaries', 'POST', { code: 'reader_no_create', ...fields('x') }, readerRaw)).status).toBe(403)
    expect((await request(`dictionaries/${row.id}/items`, 'POST', { code: 'http_option', name: 'HTTP option', sortOrder: 0, enabled: true, version: 1 })).status).toBe(200)
    expect((await request(`dictionaries/${row.id}`, 'PUT', { ...fields('Stale'), version: 1 })).status).toBe(409)
    response = await request(`dictionaries/${row.id}`); const detail = (await response.json()).data, item = detail.items[0]
    expect((await request(`dictionary-items/${item.id}`, 'PUT', { dictionaryId: row.id, name: 'Renamed', sortOrder: 5, enabled: false, version: detail.version })).status).toBe(200)
    expect((await request(`dictionaries/${row.id}/options`, 'GET', undefined, consumerRaw)).status).toBe(200)
    for (const path of [`dictionaries/${row.id}`, `dictionary-items/${item.id}`]) expect((await request(path, 'DELETE', { version: 3 })).status).toBe(403)
    for (const path of ['dictionaries/01', 'dictionaries/1/extra', 'dictionary-items/1/extra']) expect((await request(path, 'PUT', {})).status).toBe(403)
    expect((await request(`dictionaries/${row.id}`, 'PUT', { ...fields('Bad'), version: 3, code: 'changed' })).status).toBe(400)
    expect((await request(`dictionaries/${row.id}/options?version=bad`)).status).toBe(400)
    expect((await request(`dictionaries/${row.id}/options?version=${'a'.repeat(64)}&version=${'b'.repeat(64)}`)).status).toBe(400)
    expect((await request('dictionaries?sort=arbitrary')).status).toBe(400)
    await setRolePermissions(client.database, root, readRole, { version: 2, permissions: [] }, meta)
    expect((await request('dictionaries', 'GET', undefined, readerRaw)).status).toBe(403)
  })
  it('有效选项版本随修改刷新，认证/首次改密/禁用继续限制消费接口', async () => {
    const row = await create('dictionary_http_options'), result = await add(row.id, 'http_version_item')
    let response = await request(`dictionaries/${row.id}/options`, 'GET', undefined, consumerRaw); const before = (await response.json()).data
    response = await request(`dictionaries/${row.id}/options?version=${before.version}`, 'GET', undefined, consumerRaw); expect((await response.json()).data).toEqual({ changed: false, version: before.version })
    await service.updateItem(root, result.items[0]!.id, { dictionaryId: row.id, name: 'Latest', sortOrder: 0, enabled: true, version: result.version }, meta)
    response = await request(`dictionaries/${row.id}/options?version=${before.version}`, 'GET', undefined, consumerRaw); expect((await response.json()).data).toMatchObject({ changed: true, items: [{ name: 'Latest' }] })
    expect((await fetch(base + `/api/admin/dictionaries/${row.id}/options`)).status).toBe(401)
    try {
      await client.database.update(adminUsers).set({ mustChangePassword: true }).where(eq(adminUsers.id, consumer))
      expect((await request(`dictionaries/${row.id}/options`, 'GET', undefined, consumerRaw)).status).toBe(403)
      await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: false }).where(eq(adminUsers.id, consumer))
      expect((await request(`dictionaries/${row.id}/options`, 'GET', undefined, consumerRaw)).status).toBe(401)
    } finally { await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: true }).where(eq(adminUsers.id, consumer)) }
  })
})
