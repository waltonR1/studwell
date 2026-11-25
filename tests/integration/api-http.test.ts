import type {ApiErrorCode} from '../../shared/types/api-errors'
// 真实 H3 HTTP 边界测试；示例路由仅挂在临时服务器，不进入 Nuxt API。
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, toNodeListener } from 'h3'
import { z } from 'zod'
import requestIdMiddleware from '../../server/middleware/request-id'
import {ApiError, conflictError} from '../../server/core/errors'
import { defineApiHandler } from '../../server/http/handler'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseJsonBody, parseParams, parseQuery} from '../../server/http/validation'
import {listQuerySchema} from '#shared/schemas/admin/pagination'
import { isManagedApiPath } from '../../server/http/request-id'

let server: Server
let base: string

beforeAll(async () => {
  const app = createApp()
  app.use(requestIdMiddleware)
  const router = createRouter()
  router.get('/api/public/items', defineApiHandler(async event => {
    const query = await parseQuery(event, listQuerySchema)
    return { items: [{ id: '18446744073709551615', name: 'fixture' }], ...query, total: 1 }
  }))
  router.get('/api/public/items/:id', defineApiHandler(async event => parseParams(event, z.strictObject({ id: entityIdSchema }))))
  router.post('/api/public/body', defineApiHandler(async event => parseJsonBody(event, z.strictObject({ name: z.string().min(1) }))))
  router.get('/api/public/error/:code', defineApiHandler(async event => {
    const { code } = await parseParams(event, z.strictObject({ code: z.enum(['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'RATE_LIMITED']) }))
    throw new ApiError(code)
  }))
  router.get('/api/public/conflict/:reason', defineApiHandler(async event => {
    const { reason } = await parseParams(event, z.strictObject({ reason: z.enum(['STALE', 'DUPLICATE', 'REFERENCED', 'RETRY']) }))
    throw conflictError(reason)
  }))
  router.get('/api/public/unknown', defineApiHandler(() => { throw new Error('SQL SELECT password_hash; cookie=SECRET; internal-stack') }))
  router.get('/api/public/undefined', defineApiHandler(() => undefined))
  router.get('/api/public/bigint', defineApiHandler(() => ({ id: 18446744073709551615n })))
  router.get('/outside', () => ({ ok: true }))
  app.use(router)
  server = createServer(toNodeListener(app))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) })

describe('API HTTP 协议', () => {
  it('成功合同、分页及请求标识', async () => {
    const response = await fetch(`${base}/api/public/items?page=2&pageSize=10`, { headers: { 'X-Request-ID': 'client-supplied' } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, data: { items: [{ id: '18446744073709551615' }], page: 2, pageSize: 10, total: 1 } })
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.requestId).toBe(response.headers.get('x-request-id'))
    expect(body.requestId).not.toBe('client-supplied')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const second = await fetch(`${base}/api/public/items`)
    expect(second.headers.get('x-request-id')).not.toBe(body.requestId)
  })
  it('非法查询遵守错误响应合同', async () => {
    const response = await fetch(`${base}/api/public/items?page=1&page=2&sort=password_hash`)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'INVALID_INPUT' } })
  })
  it('路径参数校验并保持大 ID 字符串', async () => {
    const response = await fetch(`${base}/api/public/items/18446744073709551615`)
    expect(await response.json()).toMatchObject({ data: { id: '18446744073709551615' } })
    expect((await fetch(`${base}/api/public/items/not-an-id`)).status).toBe(400)
  })
  it('JSON 输入完整校验，拒绝多余字段', async () => {
    const post = (body: string, contentType = 'application/json') => fetch(`${base}/api/public/body`, { method: 'POST', headers: { 'Content-Type': contentType }, body })
    expect((await post('{"name":"test"}')).status).toBe(200)
    expect((await post('{"name":"test","role":"root"}')).status).toBe(400)
    expect((await post('{invalid}')).status).toBe(400)
    expect((await post('')).status).toBe(400)
    expect((await post('name=test', 'application/x-www-form-urlencoded')).status).toBe(415)
  })
  it.each<[ApiErrorCode, number]>([['UNAUTHENTICATED', 401], ['FORBIDDEN', 403], ['NOT_FOUND', 404], ['CONFLICT', 409], ['RATE_LIMITED', 429]])('受控错误 %s 对应 %i', async (code, status) => {
    const response = await fetch(`${base}/api/public/error/${code}`)
    const body = await response.json()
    expect(response.status).toBe(status)
    expect(body).toMatchObject({ success: false, error: { code }, requestId: response.headers.get('x-request-id') })
    expect(body.error.message).toMatch(/[\u4e00-\u9fff]/)
  })
  it.each(['STALE', 'DUPLICATE', 'REFERENCED', 'RETRY'])('409 原因 %s 保持 HTTP 冲突状态并安全序列化', async reason => {
    const response = await fetch(`${base}/api/public/conflict/${reason}`)
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body).toMatchObject({ success: false, error: { code: 'CONFLICT', reason } })
  })
  it('未知异常响应和应用日志都不泄露内部信息', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await fetch(`${base}/api/public/unknown`)
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toMatchObject({ success: false, error: { code: 'INTERNAL_ERROR' } })
    expect(JSON.stringify(body)).not.toMatch(/SQL|SECRET|stack|password_hash/)
    const diagnostic = JSON.parse(log.mock.calls[0]![0])
    expect(diagnostic).toMatchObject({ level: 'error', event: 'admin_diagnostic', stage: 'api', requestId: body.requestId, reason: 'UNEXPECTED', errors: [{name: 'Error', stack: expect.arrayContaining([expect.stringContaining('api-http.test.ts')])}] })
    expect(JSON.stringify(diagnostic)).not.toMatch(/SECRET|password/)
  })
  it.each(['undefined', 'bigint'])('响应序列化问题 %s 仍遵守安全错误合同', async path => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await fetch(`${base}/api/public/${path}`)
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ success: false, error: { code: 'INTERNAL_ERROR' }, requestId: response.headers.get('x-request-id') })
  })
  it('分区匹配不误伤官网与类似名称', async () => {
    expect(isManagedApiPath('/api/public?a=b')).toBe(true)
    expect(isManagedApiPath('/api/admin/items')).toBe(true)
    expect(isManagedApiPath('/api/administrator/items')).toBe(false)
    expect(isManagedApiPath('/zh/about')).toBe(false)
    expect((await fetch(`${base}/outside`)).headers.get('x-request-id')).toBeNull()
  })
})
