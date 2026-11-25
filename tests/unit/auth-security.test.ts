// 密钥派生及代理信任边界，不连接数据库、不使用真实 Session。
import type { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { csrfToken, safeTokenEqual, tokenHash } from '../../server/services/auth'
import { authMeta } from '../../server/http/auth'

describe('认证安全原语', () => {
  it('Session 摘要、CSRF 派生相互分离且拒绝非法比较输入', () => {
    const raw = 'a'.repeat(64)
    expect(csrfToken(raw)).not.toBe(tokenHash(raw))
    expect(safeTokenEqual(csrfToken(raw), csrfToken(raw))).toBe(true)
    expect(safeTokenEqual(csrfToken(raw), csrfToken('b'.repeat(64)))).toBe(false)
    expect(safeTokenEqual('wrong', '')).toBe(false)
  })
  it('只信任明确白名单直接代理覆盖的单个 IP', () => {
    const event = { path: '/api/admin/users/1', method: 'PUT', node: { req: { socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: { 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1' } } }, context: { apiRequestId: 'fixture' } } as unknown as H3Event
    expect(authMeta(event).ip).toBe('127.0.0.1')
    expect(authMeta(event, { origin: 'http://localhost', secureCookie: false, trustedProxyIps: ['127.0.0.1'] }).ip).toBe('8.8.8.8')
    event.node.req.headers['x-real-ip'] = '8.8.8.8,1.1.1.1'
    expect(authMeta(event, { origin: 'http://localhost', secureCookie: false, trustedProxyIps: ['127.0.0.1'] }).ip).toBe('127.0.0.1')
  })
})
