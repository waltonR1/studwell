// 为公开 API 请求提供开发日志钩子，不参与业务响应处理。
import {createApiRequestLogger, type ObservedResponse} from '~/utils/api-request-debug'

type RequestEvent = { request: string | Request; options: { method?: string } }
type ResponseEvent = { response: ObservedResponse }
type ErrorEvent = { error?: unknown }

export function createPublicApiDebugHooks(side: 'server' | 'client') {
    const start = createApiRequestLogger('Public', side)
    const active = new WeakMap<object, ReturnType<typeof start>>()
    return {
        onRequest(context: RequestEvent) {
            const {request, options} = context
            const path = typeof request === 'string' ? request : request.url
            const method = options.method ?? (typeof request === 'string' ? 'GET' : request.method)
            active.set(context, start(path, method.toUpperCase()))
        },
        onResponse(context: ResponseEvent) {
            const log = active.get(context)
            if (!log) return
            active.delete(context)
            if (context.response.status >= 400) return log.fail(context)
            log.observe(context.response)
            log.succeed()
        },
        onRequestError(context: ErrorEvent) {
            const log = active.get(context)
            active.delete(context)
            return log?.fail(context.error)
        },
    }
}

