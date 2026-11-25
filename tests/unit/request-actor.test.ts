import type {H3Event} from 'h3'
import {describe, expect, it, vi} from 'vitest'
import type {createAuthService} from '../../server/services/auth'
import {csrfToken} from '../../server/services/auth'
import {ApiError} from '../../server/core/errors'
import {guardAdminRequest, requestActor} from '../../server/http/auth'

describe('请求身份复用', () => {
    it.each([
        ['GET', '/api/admin/media/1/file', 'media-read'],
        ['GET', '/api/admin/media/2/file?preview=1', 'media-read'],
        ['HEAD', '/api/admin/media/1/file', 'media-read'],
        ['GET', '/api/admin/auth/permissions', 'admin-api'],
        ['GET', '/api/admin/media', 'admin-api'],
        ['POST', '/api/admin/media', 'admin-api'],
        ['PUT', '/api/admin/media/1', 'admin-api'],
        ['DELETE', '/api/admin/media/1', 'admin-api'],
    ])('%s %s 仅占用 %s 额度且仍然鉴权', async (method, path, scope) => {
        const raw = 'a'.repeat(64)
        const service = {
            resolve: vi.fn(async () => ({user: {id: 1n, mustChangePassword: false}})),
            limit: vi.fn(), touch: vi.fn(),
        } as unknown as ReturnType<typeof createAuthService>
        const event = {path, method, context: {}, node: {req: {
            headers: {cookie: `studwell_admin_session=${raw}`, origin: 'http://localhost', 'x-csrf-token': csrfToken(raw)},
            socket: {remoteAddress: '127.0.0.1'},
        }}} as unknown as H3Event
        const authorize = vi.fn()
        await guardAdminRequest(event, service, {origin: 'http://localhost', secureCookie: false}, authorize)
        expect(service.limit).toHaveBeenCalledExactlyOnceWith(scope, '1', expect.any(Object))
        expect(authorize).toHaveBeenCalledExactlyOnceWith(1n, method, path.split('?')[0])
    })
    it('媒体读取额度耗尽时仍拒绝请求', async () => {
        const service = {
            resolve: vi.fn(async () => ({user: {id: 1n, mustChangePassword: false}})),
            limit: vi.fn(async () => { throw new ApiError('RATE_LIMITED') }), touch: vi.fn(),
        } as unknown as ReturnType<typeof createAuthService>
        const event = {path: '/api/admin/media/1/file', method: 'GET', context: {}, node: {req: {
            headers: {}, socket: {remoteAddress: '127.0.0.1'},
        }}} as unknown as H3Event
        await expect(guardAdminRequest(event, service, {origin: 'http://localhost', secureCookie: false}, vi.fn()))
            .rejects.toMatchObject({code: 'RATE_LIMITED'})
        expect(service.touch).not.toHaveBeenCalled()
    })
    it('守卫和 Handler 复用已认证身份，新请求重新解析 Session', async () => {
        const resolve = vi.fn(async () => ({user: {id: 1n, mustChangePassword: false}}))
        const service = {resolve, limit: vi.fn(), touch: vi.fn()} as unknown as ReturnType<typeof createAuthService>
        const event = () => ({path: '/api/admin/users', method: 'GET', context: {}, node: {req: {
            headers: {cookie: `studwell_admin_session=${'a'.repeat(64)}`}, socket: {remoteAddress: '127.0.0.1'},
        }}} as unknown as H3Event)
        const first = event(), authorize = vi.fn()
        await guardAdminRequest(first, service, {origin: 'http://localhost', secureCookie: false}, authorize)
        expect(await requestActor(first, service)).toBe(1n)
        expect(resolve).toHaveBeenCalledOnce()
        expect(authorize).toHaveBeenCalledOnce()
        await requestActor(event(), service)
        expect(resolve).toHaveBeenCalledTimes(2)
    })
    it('独立 Handler 没有可信守卫身份时必须验证 Session', async () => {
        const resolve = vi.fn(async () => null)
        const event = {node: {req: {headers: {}}}} as H3Event
        await expect(requestActor(event, {resolve})).rejects.toMatchObject({code: 'UNAUTHENTICATED'})
        expect(resolve).toHaveBeenCalledOnce()
    })
})
