import { describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'
import { authMeta, guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { createAuthService, csrfToken } from '../../server/services/auth'
import {ApiError, conflictError} from '../../server/core/errors'
import { logFailureReason } from '../../server/policies/log-reasons'
import {logResults, loginActions} from '../../shared/config/admin/logs'
import { logCsv } from '../../server/services/logs/csv'
import type { LogRecord } from '../../shared/types/admin/logs'
const raw = 'a'.repeat(64), options = { origin: 'http://admin.test', secureCookie: false }
function event(headers: Record<string, string> = {}) {
  return { path: '/api/admin/users/123?private=SECRET', method: 'PUT', node: { req: { socket: { remoteAddress: '127.0.0.1' }, headers: { origin: options.origin, cookie: SESSION_COOKIE + '=' + raw, 'x-csrf-token': csrfToken(raw), ...headers } } }, context: { apiRequestId: 'fixture-id' } } as unknown as H3Event
}
function service(current: unknown = { user: { id: 1n, username: 'root', mustChangePassword: false } }) {
  const mocks = { resolve: vi.fn().mockResolvedValue(current), limit: vi.fn(), log: vi.fn(), touch: vi.fn() }
  return { mocks, value: mocks as unknown as ReturnType<typeof createAuthService> }
}
describe('日志新增字段与安全边界', () => {
  it('登录/操作没有拒绝筛选，安全事件保留拒绝，登出名称一致', () => {
    expect(logResults.login).toEqual(['success', 'failed'])
    expect(logResults.audit).toEqual(['success', 'failed'])
    expect(logResults.security).toContain('denied')
    expect(loginActions.logout).toBe('登出')
  })
  it('接口只记录模板，不包含对象 ID 或查询内容；客户端转发头不能覆盖来源', () => {
    const meta = authMeta(event({ 'x-forwarded-for': '203.0.113.99' }))
    expect(meta).toMatchObject({ ip: '127.0.0.1', routeTemplate: '/api/admin/users/:id', requestMethod: 'PUT' })
    expect(JSON.stringify(meta)).not.toMatch(/SECRET|123|203.0.113.99/)
  })
  it.each([
    [{ origin: 'http://other.test' }, false, 'ORIGIN_MISMATCH'],
    [{ cookie: '' }, false, 'SESSION_MISSING'],
    [{}, true, 'SESSION_INVALID'],
    [{ 'x-csrf-token': '' }, false, 'CSRF_TOKEN_MISSING'],
    [{ 'x-csrf-token': 'b'.repeat(64) }, false, 'CSRF_TOKEN_INVALID'],
  ] as const)('安全拒绝记录受控原因 %s', async (headers, expired, reason) => {
    const auth = expired ? service(null) : service()
    await expect(guardAdminRequest(event(headers), auth.value, options)).rejects.toMatchObject({ code: 'CSRF_REJECTED' })
    expect(auth.mocks.log.mock.calls[0]?.[5]).toBe(reason)
    expect(JSON.stringify(auth.mocks.log.mock.calls, (_, value) => typeof value === 'bigint' ? String(value) : value)).not.toContain(raw)
  })
  it('权限拒绝记录登记权限和模板，不记录实际业务参数', async () => {
    const auth = service()
    await expect(guardAdminRequest(event(), auth.value, options, async () => { throw new ApiError('FORBIDDEN') })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(auth.mocks.log.mock.calls[0]?.[2]).toMatchObject({ permissionCode: 'system.users.update', routeTemplate: '/api/admin/users/:id' })
    expect(auth.mocks.log.mock.calls[0]?.[5]).toBe('PERMISSION_DENIED')
  })
  it('失败原因仅白名单分类，不回传异常内容', () => {
    expect(logFailureReason(conflictError('STALE'))).toBe('STALE')
    expect(logFailureReason({ cause: { code: 'ER_DUP_ENTRY', message: 'SECRET SQL' } })).toBe('DUPLICATE')
    expect(logFailureReason(new Error('SECRET SQL password'))).toBe('INTERNAL_ERROR')
  })
  it('CSV保留诊断字段，但来源未勾选时不输出 IP/User-Agent', () => {
    const record: LogRecord = { id: '1', kind: 'security', actorId: null, account: null, action: 'csrf', actionName: '请求安全校验失败', result: 'denied', createdAt: '2026-10-26T00:00:00.000Z', requestId: 'fixture-id', targetType: null, targetId: null, targetName: null, ip: '203.0.113.99', userAgent: 'PRIVATE-UA', exportContext: null, exportContextHidden: false, reasonCode: 'ORIGIN_MISMATCH', requestMethod: 'PUT', routeTemplate: '/api/admin/users/:id' }
    const csv = logCsv([record], false)
    expect(csv).toContain('请求来源与后台配置不一致'); expect(csv).toContain('/api/admin/users/:id')
    expect(csv).not.toContain('203.0.113.99'); expect(csv).not.toContain('PRIVATE-UA')
  })
})
