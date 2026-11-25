// Request ID 由服务器生成，不采用客户端声明的关联标识。
import {randomUUID} from 'node:crypto'
import {setResponseHeader, type H3Event} from 'h3'

export function isManagedApiPath(path: string) {
    return /^\/api\/(?:admin|public)(?:\/|$)/.test(path.split('?')[0] ?? '')
}

export function ensureRequestId(event: H3Event): string {
    if (!event.context.apiRequestId) event.context.apiRequestId = randomUUID()
    setResponseHeader(event, 'X-Request-ID', event.context.apiRequestId)
    return event.context.apiRequestId
}

declare module 'h3' {
    interface H3EventContext {
        apiRequestId?: string
    }
}
