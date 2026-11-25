import {apiFailureKind, apiDebugPath} from '~/utils/api-diagnostics'

export type ObservedResponse = Pick<Response, 'status' | 'headers'> & {_data?: unknown}

// 只输出请求元数据；认证载荷、响应数据、查询值、请求头和文件内容均不进入控制台。
export function createApiRequestLogger(scope: 'Admin' | 'Public', side: 'server' | 'client') {
    const label = `[${scope} API][${side}]`
    let sequence = 0
    return function start(path: string, method: string) {
        const started = Date.now(), id = ++sequence
        const details = {id, method, path: apiDebugPath(path)}
        let status: number | undefined, requestId: string | undefined, code: string | undefined, reason: string | undefined
        function failure(data: unknown) {
            if (!data || typeof data !== 'object') return
            const value = data as {success?: unknown; requestId?: unknown; error?: {code?: unknown; reason?: unknown}}
            if (typeof value.requestId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(value.requestId)) requestId = value.requestId
            if (value.success !== false) return
            if (typeof value.error?.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(value.error.code)) code = value.error.code
            if (typeof value.error?.reason === 'string' && /^[A-Z0-9_]{1,64}$/.test(value.error.reason)) reason = value.error.reason
        }
        function observe(response: ObservedResponse) {
            status = response.status
            requestId = undefined; code = undefined; reason = undefined
            const header = response.headers.get('x-request-id')
            if (header && /^[a-zA-Z0-9-]{1,128}$/.test(header)) requestId = header
            failure(response._data)
        }
        console.log(`${label} request`, details)
        function succeed() {
            console.log(`${label} response`, {...details, status, requestId, durationMs: Math.max(0, Date.now() - started)})
        }
        async function fail(error: unknown) {
            const value = error as {response?: ObservedResponse; statusCode?: number; data?: unknown} | null
            if (value?.response) observe(value.response)
            status ??= typeof value?.statusCode === 'number' ? value.statusCode : undefined
            failure(value?.data)
            // 导出接口的失败响应仍可能是 Blob；只提取协议编号和受控编码。
            if (value?.data instanceof Blob && value.data.size <= 65536) {
                try { failure(JSON.parse(await value.data.text())) } catch { /* 无效响应仍记录状态与请求编号。 */ }
            }
            console.error(`${label} error`, {...details, status, requestId, code, reason, failureKind: apiFailureKind(error, status, code), durationMs: Math.max(0, Date.now() - started)})
        }
        return {observe, succeed, fail}
    }
}

export function createApiDebug(scope: 'Admin' | 'Public', enabled: boolean, side: 'server' | 'client') {
    const start = createApiRequestLogger(scope, side)
    return async function trace<T>(path: string, method: string, work: (observe: (response: ObservedResponse) => void) => Promise<T>): Promise<T> {
        if (!enabled) return work(() => {})
        const log = start(path, method)
        try {
            const result = await work(log.observe)
            log.succeed()
            return result
        } catch (error) {
            await log.fail(error)
            throw error
        }
    }
}
