import {afterEach, describe, expect, it, vi} from 'vitest'
import {createAdminApiDebug} from '../../app/api/admin/request-debug'
import {ApiTransportError, apiFailureKind} from '../../app/utils/api-diagnostics'
import {createAdminHttpApi} from '../../app/api/admin/http'
vi.mock('~/config/admin/api', () => ({adminApiConfig: {debug: true}}))
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals()})
const response = (status = 200) => ({status, headers: new Headers({'X-Request-ID': 'request-1'})})

describe('后台 API 开发日志', () => {
    it.each(['NETWORK_ERROR', 'ABORTED', 'TIMEOUT', 'INVALID_RESPONSE'] as const)('受控失败分类 %s 保留原异常且不输出消息', async kind => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const cause = new ApiTransportError(kind, 'PRIVATE_MESSAGE')
        await expect(createAdminApiDebug(true, 'client')('media', 'POST', async () => {throw cause})).rejects.toBe(cause)
        expect(log.mock.calls[0]?.[1]).toMatchObject({failureKind: kind})
        expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_MESSAGE')
    })
    it('识别 fetch 包装的取消、超时和 JSON 解析异常', () => {
        expect(apiFailureKind(new Error('fetch failed', {cause: Object.assign(new Error(), {name: 'AbortError'})}))).toBe('ABORTED')
        expect(apiFailureKind(new Error('fetch failed', {cause: Object.assign(new Error(), {code: 'UND_ERR_CONNECT_TIMEOUT'})}))).toBe('TIMEOUT')
        expect(apiFailureKind(new SyntaxError('PRIVATE'))).toBe('INVALID_RESPONSE')
        expect(apiFailureKind({}, 503)).toBe('HTTP_ERROR')
        expect(apiFailureKind({}, 409, 'CONFLICT')).toBe('API_ERROR')
    })
    it('关闭时不打印、不解析响应、不改变返回结果或异常', async () => {
        const debug = vi.spyOn(console, 'log').mockImplementation(() => {}), error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const trace = createAdminApiDebug(false, 'client'), failure = new Error('original'), data = {secret: 'PRIVATE'}
        expect(await trace('users', 'GET', async observe => {observe(response()); return data})).toBe(data)
        await expect(trace('users', 'GET', async () => {throw failure})).rejects.toBe(failure)
        expect(debug).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled()
    })
    it('成功只输出元数据，不打印查询值、认证数据和完整响应', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const trace = createAdminApiDebug(true, 'client'), data = {csrfToken: 'PRIVATE_CSRF', password: 'PRIVATE_PASSWORD'}
        expect(await trace('auth/session?secret=PRIVATE_QUERY', 'GET', async observe => {
            observe({...response(), _data: {success: true, data, requestId: 'request-1'}})
            return data
        })).toBe(data)
        expect(log).toHaveBeenCalledTimes(2)
        expect(log.mock.calls[1]?.[1]).toMatchObject({method: 'GET', path: '/api/admin/auth/session', status: 200, requestId: 'request-1', durationMs: expect.any(Number)})
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE|csrfToken|password/)
    })
    it('下载失败从 Blob 提取错误编码，保留原异常且不输出错误原文', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const failure = {statusCode: 409, data: new Blob([JSON.stringify({success: false, requestId: 'request-blob', error: {code: 'CONFLICT', reason: 'STALE', message: 'PRIVATE_MESSAGE'}})])}
        await expect(createAdminApiDebug(true, 'client')('logs/audit/export', 'POST', async () => {throw failure})).rejects.toBe(failure)
        expect(log.mock.calls[0]?.[1]).toMatchObject({status: 409, requestId: 'request-blob', code: 'CONFLICT', reason: 'STALE'})
        expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_MESSAGE')
    })
    it('网络错误和无效 Blob 不影响原异常传播', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        const trace = createAdminApiDebug(true, 'server'), network = new Error('PRIVATE_NETWORK'), invalid = {statusCode: 502, data: new Blob(['invalid'])}
        await expect(trace('users', 'GET', async () => {throw network})).rejects.toBe(network)
        await expect(trace('logs/audit/export', 'POST', async () => {throw invalid})).rejects.toBe(invalid)
        expect(log).toHaveBeenCalledTimes(2)
        expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE_NETWORK')
    })
    it('统一入口覆盖读取、会话、认证、写入、普通上传和下载', async () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        const fetcher = vi.fn(async (_path, options) => {options.onResponse({response: {...response(), _data: {success: true, data: {ok: true}}}}); return {data: {ok: true}}})
        const blob = new Blob(['CSV_PRIVATE'])
        const raw = vi.fn(async (_path, options) => {
            const result = {...response(), _data: blob, headers: new Headers({'X-Request-ID': 'request-1', 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="audit.csv"'})}
            options.onResponse({response: result}); return result
        })
        vi.stubGlobal('useRequestFetch', () => fetcher); vi.stubGlobal('$fetch', Object.assign(fetcher, {raw}))
        const http = createAdminHttpApi(), file = new File(['PRIVATE_FILE'], 'private.png', {type: 'image/png'})
        await http.read('users'); await http.session(); await http.auth('login', {password: 'PRIVATE_PASSWORD'}, 'PRIVATE_CSRF')
        await http.mutate('users/1', 'PUT', {password: 'PRIVATE_PASSWORD'}, 'PRIVATE_CSRF')
        await http.upload('media', file, 'PRIVATE_CSRF'); await http.download('logs/audit/export', {}, 'PRIVATE_CSRF')
        expect(log.mock.calls.filter(call => String(call[0]).endsWith(' response'))).toHaveLength(6)
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE|private.png/)
    })
    it('XHR 进度上传的失败保留状态码和请求编号', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubGlobal('useRequestFetch', () => vi.fn())
        class Xhr {
            status = 500
            responseText = JSON.stringify({success: false, requestId: 'request-upload', error: {code: 'INTERNAL_ERROR'}})
            upload = {}
            onload?: () => void
            open() {}
            setRequestHeader() {}
            getResponseHeader() {return 'request-upload'}
            send() {this.onload?.()}
        }
        vi.stubGlobal('XMLHttpRequest', Xhr)
        await expect(createAdminHttpApi().upload('media', new File(['PRIVATE_FILE'], 'a.png'), 'PRIVATE_CSRF', undefined, vi.fn())).rejects.toMatchObject({statusCode: 500})
        expect(log.mock.calls[0]?.[1]).toMatchObject({status: 500, requestId: 'request-upload', code: 'INTERNAL_ERROR'})
        expect(JSON.stringify(log.mock.calls)).not.toMatch(/PRIVATE/)
    })
})
