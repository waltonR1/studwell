// 真实 HTTP + 专用 MySQL 认证集成；使用虚构账号，不读开发库 Root 凭据。
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3'
import { eq } from 'drizzle-orm'
import { setupTestDatabase, cleanTestDatabase } from './support'
import { createAuthService, tokenHash } from '../../server/services/auth'
import {seedRoot} from '../../scripts/database/seed/system'
import {createAccountService} from '../../server/services/accounts'
import { accountRepository } from '../../server/repositories/accounts'
import { authRepository } from '../../server/repositories/auth'
import { adminAuthLogs, adminSessions } from '../../server/db/schema'
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth'
import { authHandlers } from '../../server/http/handlers/auth-handlers'
import { ensureRequestId } from '../../server/http/request-id'
import { apiErrorResponse } from '../../server/http/handler'

let client: Awaited<ReturnType<typeof setupTestDatabase>>
let server: Server
let base: string
let service: ReturnType<typeof createAuthService>
let rootId: string
let now = new Date()
const password = 'Auth fixture Starlight 8426!'
const nextPassword = 'Changed fixture Firelight 7520!'
const options = { origin: 'http://admin.test', secureCookie: false }
let counter = 0
const meta = () => ({ ip: '127.0.0.1', userAgent: 'fixture', requestId: '00000000-0000-4000-8000-000000000001' })
beforeAll(async () => {
  client = await setupTestDatabase()
  rootId = (await seedRoot(client.database, password)).id
  service = createAuthService(client.database, () => now, true)
  const app = createApp(), router = createRouter(), handlers = authHandlers(service, options)
  app.use(defineEventHandler(async event => {
    ensureRequestId(event)
    try { await guardAdminRequest(event, service, options) } catch (error) { return apiErrorResponse(event, error) }
  }))
  router.get('/api/admin/auth/session', handlers.session)
  router.post('/api/admin/auth/login', handlers.login)
  router.post('/api/admin/auth/logout', handlers.logout)
  router.post('/api/admin/auth/password', handlers.password)
  router.get('/api/admin/protected', () => ({ shouldNeverBeReached: true }))
  app.use(router)
  server = createServer(toNodeListener(app))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()))
  if (client) await cleanTestDatabase(client)
})
async function browser() {
  let cookie = '', csrf = ''
  return {
    get cookie() { return cookie },
    async request(path: string, body?: Record<string, string>, extra: Record<string, string> = {}) {
      const response = await fetch(`${base}/api/admin/${path}`, { method: body ? 'POST' : 'GET', headers: { cookie, ...(body ? { Origin: options.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined })
      const set = response.headers.get('set-cookie')
      if (set) cookie = set.split(';')[0]!
      const payload = await response.json()
      if (payload.data?.csrfToken) csrf = payload.data.csrfToken
      return { response, payload }
    },
  }
}
async function ordinary() {
  const username = `auth_${++counter}`
  const user = await createAccountService(client.database).createOrdinary({ username, displayName: 'Fixture', password }, rootId)
  const agent = await browser()
  await agent.request('auth/session')
  const login = await agent.request('auth/login', { username, password })
  expect(login.response.status).toBe(200)
  await agent.request('auth/session')
  return { user, agent }
}

describe('认证纵向闭环', () => {
  it('匿名引导 Cookie/CSRF、错误凭据统一且防止 Session 固定', async () => {
    const agent = await browser()
    const bootstrap = await agent.request('auth/session')
    expect(bootstrap.payload.data.authenticated).toBe(false)
    expect(bootstrap.response.headers.get('set-cookie')).toMatch(/HttpOnly/)
    expect(bootstrap.response.headers.get('set-cookie')).toMatch(/SameSite=Lax/)
    const anonymous = agent.cookie
    const failed = await agent.request('auth/login', { username: 'unknown_user', password })
    expect(failed.response.status).toBe(401)
    expect(failed.payload.error.code).toBe('AUTH_FAILED')
    const wrong = await agent.request('auth/login', { username: 'root', password: 'wrong' })
    expect(wrong.payload.error).toEqual(failed.payload.error)
    const login = await agent.request('auth/login', { username: 'root', password })
    expect(login.response.status).toBe(200)
    expect(agent.cookie).not.toBe(anonymous)
    const raw = anonymous.split('=')[1]!
    expect(await service.resolve(raw)).toBeNull()
    expect(JSON.stringify(login.payload)).not.toContain(agent.cookie.split('=')[1])
    const stored = await client.database.select().from(adminSessions)
    expect(stored.some(row => row.tokenHash === agent.cookie.split('=')[1])).toBe(false)
  })
  it('未认证入口、Origin、CSRF 均服务端拒绝；伪造代理头无效', async () => {
    expect((await fetch(`${base}/api/admin/protected`)).status).toBe(401)
    const agent = await browser()
    await agent.request('auth/session')
    const evil = await agent.request('auth/login', { username: 'root', password }, { Origin: 'https://evil.test', 'X-Forwarded-For': '8.8.8.8' })
    expect(evil.response.status).toBe(403)
    expect(evil.payload.error.code).toBe('CSRF_REJECTED')
    const csrf = await agent.request('auth/login', { username: 'root', password }, { 'X-CSRF-Token': '0'.repeat(64) })
    expect(csrf.response.status).toBe(403)
    const missingOrigin = await agent.request('auth/login', { username: 'root', password }, { Origin: '' })
    expect(missingOrigin.response.status).toBe(403)
    const large = await agent.request('auth/login', { username: 'root', password: 'x'.repeat(20000) })
    expect(large.response.status).toBe(413)
    const logs = await client.database.select().from(adminAuthLogs).where(eq(adminAuthLogs.action, 'csrf'))
    expect(logs.every(row => row.ip === '127.0.0.1')).toBe(true)
  })
  it('Root 首次改密限制及改密后撤销所有会话，旧密码不能再用', async () => {
    const agent = await browser()
    await agent.request('auth/session')
    await agent.request('auth/login', { username: 'root', password })
    const status = await agent.request('auth/session')
    expect(status.payload.data.mustChangePassword).toBe(true)
    const protectedResult = await agent.request('protected')
    expect(protectedResult.payload.error.code).toBe('PASSWORD_CHANGE_REQUIRED')
    const same = await agent.request('auth/password', { oldPassword: password, newPassword: password })
    expect(same.response.status).toBe(401)
    const changed = await agent.request('auth/password', { oldPassword: password, newPassword: nextPassword })
    expect(changed.response.status).toBe(200)
    expect(changed.response.headers.get('set-cookie')).toMatch(/Max-Age=0/)
    const sessions = await client.database.select().from(adminSessions).where(eq(adminSessions.userId, BigInt(rootId)))
    expect(sessions).toHaveLength(0)
    await agent.request('auth/session')
    expect((await agent.request('auth/login', { username: 'root', password })).response.status).toBe(401)
    // 新密码可登录；清除此前成功/失败尝试的时间窗以避免此项触发账号限流。
    now = new Date(now.getTime() + 16 * 60_000)
    await agent.request('auth/session')
    expect((await agent.request('auth/login', { username: 'root', password: nextPassword })).response.status).toBe(200)
    const current = await agent.request('auth/session')
    expect(current.payload.data.mustChangePassword).toBe(false)
    expect((await agent.request('protected')).payload.error.code).toBe('FORBIDDEN')
    expect((await agent.request('auth/logout', {})).response.status).toBe(200)
    expect((await agent.request('auth/session')).payload.data.authenticated).toBe(false)
  })
  it('Session 状态轮询不续命；空闲和绝对超时都拒绝', async () => {
    const { agent } = await ordinary()
    const raw = agent.cookie.split('=')[1]!
    const before = await authRepository.session(client.database, tokenHash(raw))
    now = new Date(now.getTime() + before!.idleTimeoutMs - 1)
    expect((await agent.request('auth/session')).payload.data.authenticated).toBe(true)
    expect((await authRepository.session(client.database, tokenHash(raw)))!.lastActivityAt).toEqual(before!.lastActivityAt)
    now = new Date(now.getTime() + 1)
    expect((await agent.request('auth/session')).payload.data.authenticated).toBe(false)
    const second = await ordinary()
    const otherRaw = second.agent.cookie.split('=')[1]!
    now = (await authRepository.session(client.database, tokenHash(otherRaw)))!.expiresAt
    await authRepository.touch(client.database, tokenHash(otherRaw), now)
    expect(await service.resolve(otherRaw)).toBeNull()
  })
  it('禁用、重置、软删除事务撤销 Session；版本冲突不撤销', async () => {
    for (const action of ['disable', 'reset', 'delete', 'conflict']) {
      const { user, agent } = await ordinary(), accounts = createAccountService(client.database)
      const raw = agent.cookie.split('=')[1]!
      if (action === 'disable') await accounts.updateOrdinary(user.id, 1, rootId, { enabled: false })
      if (action === 'reset') await accounts.resetOrdinaryPassword(user.id, 1, rootId, password + 'new')
      if (action === 'delete') await accounts.softDeleteOrdinary(user.id, 1, rootId)
      if (action === 'conflict') await expect(accounts.updateOrdinary(user.id, 2, rootId, { enabled: false })).rejects.toMatchObject({ code: 'CONFLICT' })
      expect(!!await service.resolve(raw)).toBe(action === 'conflict')
    }
  })
  it('并发限流原子计数，429 有 Retry-After，窗口过后恢复', async () => {
    const checks = await Promise.allSettled(Array.from({ length: 12 }, () => service.limit('login-account', 'atomic-fixture', meta())))
    expect(checks.filter(result => result.status === 'fulfilled')).toHaveLength(5)
    const agent = await browser()
    now = new Date(now.getTime() + 16 * 60_000)
    await agent.request('auth/session')
    for (let i = 0; i < 5; i++) await agent.request('auth/login', { username: 'lock_fixture', password: 'wrong' })
    const denied = await agent.request('auth/login', { username: 'lock_fixture', password: 'wrong' })
    expect(denied.response.status).toBe(429)
    expect(Number(denied.response.headers.get('retry-after'))).toBeGreaterThan(0)
    now = new Date(now.getTime() + 16 * 60_000)
    await agent.request('auth/session')
    expect((await agent.request('auth/login', { username: 'lock_fixture', password: 'wrong' })).response.status).toBe(401)
  })
  it('禁用账号与未知账号返回相同错误；日志不含密码或 Token', async () => {
    const { user } = await ordinary()
    await createAccountService(client.database).updateOrdinary(user.id, 1, rootId, { enabled: false })
    const agent = await browser()
    await agent.request('auth/session')
    const denied = await agent.request('auth/login', { username: user.username, password })
    const missing = await agent.request('auth/login', { username: 'missing_fixture', password })
    expect(denied.payload.error).toEqual(missing.payload.error)
    const logs = JSON.stringify(await client.database.select().from(adminAuthLogs), (_, value) => typeof value === 'bigint' ? String(value) : value)
    expect(logs).not.toContain(password)
    expect(logs).not.toContain(nextPassword)
    expect(logs).not.toContain(SESSION_COOKIE)
    expect(logs).not.toContain(agent.cookie.split('=')[1])
    const root = await accountRepository.findByUsername(client.database, 'root')
    expect(logs).not.toContain(root!.passwordHash)
  })
  it('HTTPS Cookie 标记及非法环境配置关闭入口', async () => {
    const previous = { ...options }
    try {
      options.origin = 'https://admin.test'; options.secureCookie = true
      const agent = await browser()
      const bootstrap = await agent.request('auth/session')
      expect(bootstrap.response.headers.get('set-cookie')).toMatch(/; Secure/)
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      options.origin = 'http://admin.test'
      expect((await agent.request('auth/session')).response.status).toBe(500)
      log.mockRestore()
    } finally { Object.assign(options, previous) }
  })
  it('关闭名单时普通创建、重置和本人改密均可使用名单内密码', async () => {
    const accounts = createAccountService(client.database, false)
    const user = await accounts.createOrdinary({ username: 'policy_fixture', displayName: 'Policy', password: '123456' }, rootId)
    await accounts.resetOrdinaryPassword(user.id, 1, rootId, 'passwordpassword')
    const disabled = createAuthService(client.database, () => now, false)
    const anonymous = await disabled.bootstrap(undefined, meta())
    const login = await disabled.login(anonymous.raw, user.username, 'passwordpassword', meta())
    await expect(service.changePassword(login.raw, 'passwordpassword', 'qwertyuiopasdfghjkl', meta())).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await disabled.changePassword(login.raw, 'passwordpassword', 'qwertyuiopasdfghjkl', meta())
    expect(await disabled.resolve(login.raw)).toBeNull()
    expect((await accountRepository.findById(client.database, BigInt(user.id)))!.mustChangePassword).toBe(false)
  })
})
