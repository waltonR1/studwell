import {afterEach, expect, it, vi} from 'vitest'
import {createPublicApiDebugHooks} from '../../app/api/public/request-debug'

afterEach(() => vi.restoreAllMocks())

it('官网日志只输出实际请求的路径和响应元数据', () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  const hooks = createPublicApiDebugHooks('server')
  const request = {
    request: '/api/public/pages/home?test=PRIVATE_URL',
    options: {query: {locale: 'PRIVATE_QUERY'}},
    response: {status: 200, headers: new Headers({'X-Request-ID': 'public-1'}), _data: {success: true, data: 'PRIVATE_BODY'}},
  }

  expect(log).not.toHaveBeenCalled()
  hooks.onRequest(request)
  hooks.onResponse(request)
  expect(log.mock.calls).toEqual([
    ['[Public API][server] request', expect.objectContaining({method: 'GET', path: '/api/public/pages/home'})],
    ['[Public API][server] response', expect.objectContaining({status: 200, requestId: 'public-1', durationMs: expect.any(Number)})],
  ])
  expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE')
})

it('官网并发请求各自关联响应，失败只记录受控错误编码', async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const hooks = createPublicApiDebugHooks('client')
  const missing = {
    request: '/api/public/site-settings',
    options: {},
    response: {status: 404, headers: new Headers(), _data: {success: false, requestId: 'public-2', error: {code: 'NOT_FOUND'}}},
  }
  const network = {request: '/api/public/pages/home', options: {}, error: new Error('PRIVATE_MESSAGE')}
  hooks.onRequest(missing)
  hooks.onRequest(network)
  await hooks.onRequestError(network)
  await hooks.onResponse(missing)
  expect(log.mock.calls).toEqual([
    ['[Public API][client] error', expect.objectContaining({path: '/api/public/pages/home', failureKind: 'NETWORK_ERROR'})],
    ['[Public API][client] error', expect.objectContaining({
      path: '/api/public/site-settings', status: 404, requestId: 'public-2', code: 'NOT_FOUND', failureKind: 'API_ERROR',
    })],
  ])
  expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE')
})
