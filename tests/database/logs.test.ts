import {setRolePermissions} from './authorization-fixture'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import { auditRepository } from '../../server/repositories/audit'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { createRoleService } from '../../server/services/roles'
import { createRbacService } from '../../server/services/rbac'
import { createLogService } from '../../server/services/logs'
import { createParameterService } from '../../server/services/parameters'
import { createAuthService, csrfToken } from '../../server/services/auth'
import { adminAuthLogs, adminOperationLogs, adminUsers, adminUserRoles } from '../../server/db/schema'
import { logHandlers } from '../../server/http/handlers/log-handlers'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'
import {logKinds} from '../../shared/config/admin/logs'
import type { LogExportContext } from '../../shared/types/admin/logs'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, reader: bigint, exporter: bigint, viewer: bigint, sourceExporter: bigint, exportOnly: bigint, readRole: string, server: Server, base: string
let service: ReturnType<typeof createLogService>, rootRaw: string, readerRaw: string, exporterRaw: string, contextId: string, loginId: string, securityId: string
const password = 'Log fixture Aurora 84127!', meta = { ip: '127.0.0.1', userAgent: 'logs-test', requestId: '00000000-0000-4000-8000-000000000001' }, options = { origin: 'http://logs.test', secureCookie: false }
const now = new Date('2026-10-22T04:00:00Z'), account = 'log_fixture_user', ip = '203.0.113.17', ua = 'Sensitive fixture User Agent'
const custom = { period: 'custom', startDate: '2026-10-16', endDate: '2026-10-22' }
async function request(path: string, method = 'GET', body?: object, token = rootRaw, csrf = true) { return fetch(base + '/api/admin/' + path, { method, headers: { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'X-CSRF-Token': csrf ? csrfToken(token) : 'bad', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }
beforeAll(async () => {
  client = await setupTestDatabase(); root = BigInt((await seedRoot(client.database, password)).id)
  await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, root))
  const accounts = createAccountService(client.database, false), roles = createRoleService(client.database), rbac = createRbacService(client.database); await rbac.sync()
  const allRead = logKinds.map(kind => `system.logs.${kind}.read`), allExport = logKinds.map(kind => `system.logs.${kind}.export`)
  const allSourceRead = logKinds.map(kind => `system.logs.${kind}.sources.read`), allSourceExport = logKinds.map(kind => `system.logs.${kind}.sources.export`)
  const users: bigint[] = []
  for (const [code, permissions] of [['log_reader', ['system.logs.login.read', 'system.logs.audit.read']], ['log_exporter', [...allRead, ...allExport]], ['log_source_viewer', [...allRead, ...allExport, ...allSourceRead]], ['log_source_exporter', [...allRead, ...allExport, ...allSourceRead, ...allSourceExport]], ['log_export_only', ['system.logs.login.export', ...allSourceExport, 'system.logs.audit.read', 'system.logs.audit.export', 'system.logs.security.read']]] as const) {
    const user = BigInt((await accounts.createOrdinary({ username: code, displayName: code, password }, String(root))).id); users.push(user)
    const role = await roles.create(root, { code, name: code, enabled: true }, meta); await setRolePermissions(client.database, root, role.id, { version: 1, permissions: [...permissions] }, meta)
    await client.database.insert(adminUserRoles).values({ userId: user, roleId: BigInt(role.id) }); if (code === 'log_reader') readRole = role.id
  }
  ;[reader, exporter, viewer, sourceExporter, exportOnly] = users as [bigint, bigint, bigint, bigint, bigint]
  await client.database.update(adminUsers).set({ mustChangePassword: false })
  service = createLogService(client.database, () => now)
  const authBase = { userId: root, username: account, ip, userAgent: ua, requestId: meta.requestId, result: 'success' }
  await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', [
    { ...authBase, action: 'login', createdAt: new Date('2026-10-15T15:59:59.999Z') },
    { ...authBase, action: 'login', createdAt: new Date('2026-10-15T16:00:00Z') },
    { ...authBase, action: 'login', result: 'failed', createdAt: new Date('2026-10-21T16:00:00Z') },
    { ...authBase, action: 'logout', createdAt: new Date('2026-10-22T02:00:00Z') },
    { ...authBase, action: 'login', createdAt: new Date('2026-10-22T16:00:00Z') },
    { ...authBase, action: 'csrf', result: 'denied', createdAt: now },
    { ...authBase, action: 'password_change', result: 'failed', createdAt: now },
    { ...authBase, action: 'future_security_event', result: 'denied', createdAt: now },
  ]))
  const [login] = await client.database.select().from(adminAuthLogs).where(and(eq(adminAuthLogs.username, account), eq(adminAuthLogs.action, 'logout'))); loginId = String(login!.id)
  const [security] = await client.database.select().from(adminAuthLogs).where(eq(adminAuthLogs.action, 'csrf')); securityId = String(security!.id)
  const context: LogExportContext = { version: 1, kind: 'security', start: '2026-10-15T16:00:00.000Z', endExclusive: '2026-10-22T16:00:00.000Z', filters: { account: 'security_subject', ip: '203.0.113.99', result: 'denied' }, rowCount: 1, includeSources: true }
  await client.database.insert(adminOperationLogs).values(await withEntityIds(client.database, 'admin_operation_logs', [
    { ...meta, actorId: root, action: 'users.update', targetType: 'user', targetId: '123', targetName: '=HYPERLINK("evil")', result: 'success', ip, userAgent: ua, createdAt: now },
    { ...meta, actorId: root, action: 'logs.export', targetType: 'log_export', targetName: '安全事件 CSV', result: 'success', ip, userAgent: ua, exportContext: context, createdAt: now },
  ]))
  const [contextRow] = await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.action, 'logs.export')); contextId = String(contextRow!.id)
  const auth = createAuthService(client.database, undefined, false)
  async function loginUser(username: string) { const anonymous = await auth.bootstrap(undefined, meta); return (await auth.login(anonymous.raw, username, password, meta)).raw }
  rootRaw = await loginUser('root'); readerRaw = await loginUser('log_reader'); exporterRaw = await loginUser('log_exporter')
  const app = createApp(), router = createRouter()
  app.use(defineEventHandler(async event => { ensureRequestId(event); try { await guardAdminRequest(event, auth, options, rbac.authorize) } catch (error) { return apiErrorResponse(event, error) } }))
  for (const kind of logKinds) { const handler = logHandlers(client.database, options, kind); router.get(`/api/admin/logs/${kind}`, handler.list).get(`/api/admin/logs/${kind}/:id`, handler.detail).post(`/api/admin/logs/${kind}/export`, handler.export) }
  app.use(router); server = createServer(toNodeListener(app)); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); if (client) await cleanTestDatabase(client) })
describe('日志查询与轻量导出纵向交付', () => {
  it('北京时间默认7天/自定义左闭右开、AND筛选及固定分页排序', async () => {
    const result = await service.list(root, 'login', { account })
    expect(result.total).toBe(3); expect(result.range).toEqual({ start: '2026-10-15T16:00:00.000Z', endExclusive: '2026-10-22T16:00:00.000Z' })
    expect(result.items.map(row => row.action)).toEqual(['logout', 'login', 'login'])
    expect((await service.list(root, 'login', { ...custom, account, result: 'failed', action: 'login' })).total).toBe(1)
    expect((await service.list(root, 'login', { period: 'today', account })).total).toBe(2)
    expect((await service.list(root, 'login', { period: 'custom', startDate: '2026-10-22', endDate: '2026-10-22', account })).total).toBe(2)
    expect((await service.list(root, 'login', { ...custom, account, ip: '203.0.113.18' })).total).toBe(0)
    const parameters = createParameterService(client.database), [parameter] = await parameters.list(root)
    await parameters.update(root, parameter!.id, { version: parameter!.version, value: 50 }, meta)
    expect((await service.list(root, 'login', { account })).pageSize).toBe(50)
    expect((await service.list(root, 'login', { account, pageSize: '10' })).pageSize).toBe(10)
    await expect(service.list(root, 'login', { page: '300000000000000' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await parameters.update(root, parameter!.id, { version: parameter!.version + 1, value: null }, meta)
  })
  it('认证表分类隔离、未知事件不自动归安全、不能通过登录详情读取安全记录', async () => {
    expect((await service.list(root, 'security', { ...custom, account })).total).toBe(2)
    await expect(service.list(root, 'security', { ...custom, account, action: 'other' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await expect(service.detail(reader, 'login', securityId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.detail(reader, 'security', securityId)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.detail(root, 'security', loginId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    for (const input of [{ action: 'csrf' }, { arbitrary: 'x' }]) await expect(service.list(root, 'login', input)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect((await service.list(root, 'login', { ...custom, account, actorId: String(root) })).total).toBeGreaterThan(0)
    expect((await service.list(root, 'login', { ...custom, account, actorId: '18446744073709551615' })).total).toBe(0)
    expect((await service.list(root, 'audit', { ...custom, account: 'root', actorId: String(root), action: 'users.update' })).total).toBe(1)
    expect((await service.list(root, 'audit', { ...custom, account: 'root', actorId: String(reader), action: 'users.update' })).total).toBe(0)
    expect((await service.list(root, 'audit', { ...custom, account: 'root', actorId: '123', action: 'users.update' })).total).toBe(0)
  })
  it('登录来源授权不作用于审计或安全日志，嵌套导出条件也按目标类型脱敏', async () => {
    const user = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'login_source_only', displayName: 'Login source only', password }, String(root))).id)
    await client.database.update(adminUsers).set({ mustChangePassword: false }).where(eq(adminUsers.id, user))
    const roles = createRoleService(client.database), role = await roles.create(root, { code: 'login_source_only', name: 'Login source only', enabled: true }, meta)
    await setRolePermissions(client.database, root, role.id, { version: 1, permissions: [...logKinds.flatMap(kind => [`system.logs.${kind}.read`, `system.logs.${kind}.export`]), 'system.logs.login.sources.read', 'system.logs.login.sources.export'] }, meta)
    await client.database.insert(adminUserRoles).values({ userId: user, roleId: BigInt(role.id) })
    expect(await service.detail(user, 'login', loginId)).toMatchObject({ ip, userAgent: ua })
    expect(await service.detail(user, 'security', securityId)).toMatchObject({ ip: null, userAgent: null })
    const audit = await service.detail(user, 'audit', contextId)
    expect(audit.ip).toBeNull(); expect(audit.exportContext?.filters.ip).toBeUndefined()
    for (const kind of ['audit', 'security'] as const) {
      await expect(service.list(user, kind, { ...custom, ip })).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(service.export(user, kind, { ...custom, includeSources: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    expect((await service.export(user, 'login', { ...custom, account, includeSources: true }, meta)).csv).toContain(ip)
    const existing = await roles.detail(root, role.id)
    await setRolePermissions(client.database, root, role.id, { version: existing.version, permissions: [...existing.permissions, 'system.logs.audit.sources.read'] }, meta)
    const auditWithOwnSource = await service.detail(user, 'audit', contextId)
    expect(auditWithOwnSource.ip).not.toBeNull()
    expect(auditWithOwnSource.exportContext?.filters.ip).toBeUndefined()
    expect(auditWithOwnSource.exportContextHidden).toBe(true)
  })
  it('来源字段及筛选分权，详情和CSV均无越权来源/嵌套条件泄漏', async () => {
    const rows = await service.list(reader, 'login', { ...custom, account }); expect(rows.items.every(row => row.ip === null && row.userAgent === null)).toBe(true)
    expect(await service.detail(reader, 'login', loginId)).toMatchObject({ ip: null, userAgent: null })
    await expect(service.list(reader, 'login', { ...custom, account, ip })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await service.detail(viewer, 'login', loginId)).toMatchObject({ ip, userAgent: ua })
    expect(await service.detail(reader, 'audit', contextId)).toMatchObject({ exportContext: null, exportContextHidden: true })
    const viewed = await service.detail(exporter, 'audit', contextId); expect(viewed.exportContext?.filters).toEqual({ account: 'security_subject', result: 'denied' }); expect(viewed.exportContextHidden).toBe(true)
    expect((await service.detail(sourceExporter, 'audit', contextId)).exportContext?.filters.ip).toBe('203.0.113.99')
    const normal = await service.export(viewer, 'audit', { ...custom, action: 'logs.export' }, meta)
    expect(normal.csv).not.toContain('203.0.113.99'); expect(normal.csv).not.toContain(ua)
    expect((await service.detail(exportOnly, 'audit', contextId)).exportContext?.filters.account).toBe('security_subject')
    expect((await service.export(exportOnly, 'audit', { ...custom, action: 'logs.export' }, meta)).csv).not.toContain('security_subject')
    await expect(service.export(viewer, 'login', { ...custom, account, includeSources: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.export(viewer, 'login', { ...custom, account, ip }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const sensitive = await service.export(sourceExporter, 'login', { ...custom, account, includeSources: true }, meta)
    expect(sensitive.csv).toContain('可信IP'); expect(sensitive.csv).toContain(ip); expect(sensitive.csv).toContain(ua)
  })
  it('导出权限不能代替查看，CSV固定字段及公式防护，条件与条数审计可追溯', async () => {
    await expect(service.export(reader, 'login', { ...custom, account }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.export(exportOnly, 'login', { ...custom, account }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const file = await service.export(exporter, 'audit', { ...custom, actorId: String(root), action: 'users.update' }, meta)
    expect(file.rowCount).toBe(1); expect(file.csv).toContain("'=HYPERLINK"); expect(file.csv).not.toContain('可信IP'); expect(file.csv).not.toContain(password)
    expect(file.filename).toMatch(/^audit-logs_\d{8}-\d{6}_2026-10-16_2026-10-22\.csv$/); expect(file.filename).not.toContain(account)
    const records = await client.database.select().from(adminOperationLogs).where(and(eq(adminOperationLogs.actorId, exporter), eq(adminOperationLogs.action, 'logs.export')))
    const record = records.find(row => row.exportContext?.filters.action === 'users.update')!
    expect(record.exportContext).toMatchObject({ version: 1, kind: 'audit', rowCount: 1, includeSources: false, start: '2026-10-15T16:00:00.000Z', endExclusive: '2026-10-22T16:00:00.000Z', filters: { action: 'users.update', actorId: String(root) } })
  })
  it('5000条全集允许，5001条明确拒绝且不截断；导出不接收分页', async () => {
    const fixture = { userId: root, username: 'bulk_export', action: 'login', result: 'success', ip, userAgent: ua, requestId: meta.requestId, createdAt: now }
    for (let batch = 0; batch < 5; batch++) await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', Array.from({ length: 1000 }, () => ({ ...fixture }))))
    expect((await service.list(exporter, 'login', { ...custom, account: 'bulk_export', pageSize: '10', page: '2' })).items).toHaveLength(10)
    const file = await service.export(exporter, 'login', { ...custom, account: 'bulk_export' }, meta)
    expect(file.rowCount).toBe(5000); expect(file.csv.split('\r\n').length - 2).toBe(5000)
    await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', fixture))
    await expect(service.export(exporter, 'login', { ...custom, account: 'bulk_export' }, meta)).rejects.toMatchObject({ code: 'EXPORT_LIMIT_EXCEEDED' })
    await expect(service.export(exporter, 'login', { ...custom, account, page: 2 }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('导出上限实时读取系统参数，100条允许、101条拒绝，恢复默认立即生效', async () => {
    const parameters = createParameterService(client.database), row = (await parameters.list(root)).find(item => item.key === 'admin.logs.exportLimit')!
    for (const value of [10, 99, 50001, 100.5]) await expect(parameters.update(root, row.id, { version: row.version, value }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    const saved = await parameters.update(root, row.id, { version: row.version, value: 100 }, meta)
    try {
      const fixture = { userId: root, username: 'limited_export', action: 'login', result: 'success', ip, userAgent: ua, requestId: meta.requestId, createdAt: now }
      await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', Array.from({ length: 100 }, () => ({ ...fixture }))))
      expect((await service.list(root, 'login', { ...custom, account: 'limited_export' })).exportLimit).toBe(100)
      expect((await service.export(exporter, 'login', { ...custom, account: 'limited_export' }, meta)).rowCount).toBe(100)
      await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', fixture))
      await expect(service.export(exporter, 'login', { ...custom, account: 'limited_export' }, meta)).rejects.toMatchObject({ code: 'EXPORT_LIMIT_EXCEEDED' })
      expect((await client.database.select().from(adminOperationLogs)).some(log => log.action === 'logs.export' && log.reasonCode === 'EXPORT_LIMIT_EXCEEDED')).toBe(true)
    } finally { await parameters.update(root, row.id, { version: saved.version, value: null }, meta) }
    expect((await service.export(exporter, 'login', { ...custom, account: 'limited_export' }, meta)).rowCount).toBe(101)
  })
  it('新增触发字段可读可导出，来源仍脱敏，登录/操作拒绝不适用结果', async () => {
    await client.database.insert(adminAuthLogs).values(await withEntityIds(client.database, 'admin_auth_logs', { userId: root, username: 'detail_fields', action: 'permission_check', result: 'denied', reasonCode: 'PERMISSION_DENIED', requestMethod: 'PUT', routeTemplate: '/api/admin/users/:id', permissionCode: 'system.users.update', ip, userAgent: ua, requestId: meta.requestId, createdAt: now }))
    const records = await service.list(exporter, 'security', { ...custom, account: 'detail_fields' })
    const detail = await service.detail(exporter, 'security', records.items[0]!.id)
    expect(detail).toMatchObject({ reasonCode: 'PERMISSION_DENIED', requestMethod: 'PUT', routeTemplate: '/api/admin/users/:id', permissionCode: 'system.users.update', ip: null, userAgent: null })
    const file = await service.export(exporter, 'security', { ...custom, account: 'detail_fields' }, meta)
    expect(file.csv).toContain('缺少执行该操作的权限'); expect(file.csv).toContain('/api/admin/users/:id'); expect(file.csv).not.toContain(ua)
    for (const kind of ['login', 'audit'] as const) {
      await expect(service.list(root, kind, { ...custom, result: 'denied' })).rejects.toMatchObject({ code: 'INVALID_INPUT' })
      await expect(service.export(root, kind, { ...custom, result: 'denied' }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    }
  })
  it('审计失败不交付文件，HTTP失败无附件头且沿用JSON错误合同', async () => {
    const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit failure'))
    try { await expect(service.export(exporter, 'login', { ...custom, account }, meta)).rejects.toThrow('audit failure') } finally { spy.mockRestore() }
    const httpSpy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('audit failure'))
    try {
      const response = await request('logs/login/export', 'POST', { ...custom, account }, exporterRaw)
      expect(response.status).toBe(500); expect(response.headers.get('content-type')).toContain('application/json'); expect(response.headers.get('content-disposition')).toBeNull()
      expect((await response.json()).error.code).toBe('INTERNAL_ERROR')
    } finally { httpSpy.mockRestore() }
  })
  it('真实HTTP查询/详情/CSV协议、CSRF、路径与方法、严格过滤及同Session撤权', async () => {
    const suffix = new URLSearchParams({ ...custom, account }).toString()
    let response = await request('logs/login?' + suffix, 'GET', undefined, readerRaw); expect(response.status).toBe(200); expect((await response.json()).data.total).toBe(3)
    expect((await request(`logs/login/${securityId}`, 'GET', undefined, readerRaw)).status).toBe(404)
    expect((await request('logs/security', 'GET', undefined, readerRaw)).status).toBe(403)
    expect((await request('logs/login/export', 'POST', { ...custom, account }, exporterRaw, false)).status).toBe(403)
    response = await request('logs/login/export', 'POST', { ...custom, account }, exporterRaw)
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/csv'); expect(response.headers.get('content-disposition')).toMatch(/attachment; filename="login-logs_/)
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-request-id')).toBeTruthy(); expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(response.headers.get('x-export-row-count')).toBe('3')
    expect(await response.text()).not.toContain(ua)
    response = await request('logs/login/export', 'POST', { ...custom, account: 'bulk_export' }, exporterRaw); expect(response.status).toBe(422); expect(response.headers.get('content-disposition')).toBeNull()
    expect((await response.json()).error.code).toBe('EXPORT_LIMIT_EXCEEDED')
    for (const [path, method] of [['logs/login/export', 'GET'], [`logs/login/${loginId}`, 'DELETE'], ['logs/login/01', 'GET'], ['logs/all', 'GET'], ['logs/login/1/extra', 'GET']]) expect((await request(path!, method!)).status).toBe(403)
    expect((await request('logs/login?account=x&account=y')).status).toBe(400)
    expect((await request('logs/login?sort=anything')).status).toBe(400)
    expect((await request('logs/login/export?account=override', 'POST', { ...custom, account }, exporterRaw)).status).toBe(400)
    await setRolePermissions(client.database, root, readRole, { version: 2, permissions: [] }, meta)
    expect((await request('logs/login?' + suffix, 'GET', undefined, readerRaw)).status).toBe(403)
  })
  it('审计用户名匹配同名新旧操作者，账号 ID 精确区分且不匹配操作对象', async () => {
    const accounts = createAccountService(client.database, false)
    const old = await accounts.createOrdinary({ username: 'same_actor', displayName: 'Old', password }, String(root))
    await accounts.softDeleteOrdinary(old.id, 1, String(root))
    const fresh = await accounts.createOrdinary({ username: 'same_actor', displayName: 'Fresh', password }, String(root))
    await client.database.insert(adminOperationLogs).values(await withEntityIds(client.database, 'admin_operation_logs', [old, fresh].map(user => ({ ...meta, actorId: BigInt(user.id), action: 'users.profile', targetType: 'user', targetId: String(root), targetName: 'root', result: 'success', createdAt: now }))))
    const filter = { ...custom, account: 'same_actor', action: 'users.profile' }
    expect((await service.list(root, 'audit', filter)).total).toBe(2)
    const oldOnly = await service.list(root, 'audit', { ...filter, actorId: old.id })
    expect(oldOnly.total).toBe(1)
    expect(oldOnly.items[0]!.actorId).toBe(old.id)
    expect((await service.list(root, 'audit', { ...filter, actorId: fresh.id })).total).toBe(1)
    expect((await service.list(root, 'audit', { ...filter, actorId: String(root) })).total).toBe(0)
    expect((await service.list(root, 'audit', { ...filter, account: 'same_act' })).total).toBe(0)
    const csv = await service.export(sourceExporter, 'audit', { ...filter, actorId: old.id }, meta)
    expect(csv.rowCount).toBe(1)
  })
  it('未知日志不泄漏来源，索引查询可用，匿名/首次改密/禁用账号仍受限制', async () => {
    const [plan] = await client.pool.query('EXPLAIN SELECT id FROM admin_auth_logs WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT 20', ['2026-10-15 16:00:00', '2026-10-22 16:00:00'])
    expect(JSON.stringify(plan)).toContain('admin_auth_logs_time')
    expect((await fetch(base + '/api/admin/logs/login')).status).toBe(401)
    try {
      await client.database.update(adminUsers).set({ mustChangePassword: true }).where(eq(adminUsers.id, exporter))
      expect((await request('logs/login', 'GET', undefined, exporterRaw)).status).toBe(403)
      await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: false }).where(eq(adminUsers.id, exporter))
      expect((await request('logs/login', 'GET', undefined, exporterRaw)).status).toBe(401)
    } finally { await client.database.update(adminUsers).set({ mustChangePassword: false, enabled: true }).where(eq(adminUsers.id, exporter)) }
  })
})
