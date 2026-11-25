export type ApiFailureKind = 'NETWORK_ERROR' | 'ABORTED' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'HTTP_ERROR' | 'API_ERROR' | 'UNKNOWN_ERROR'

// 传输层自己产生的错误使用受控分类，日志无需读取可能含 URL/凭据的异常消息。
export class ApiTransportError extends Error {
    constructor(readonly kind: ApiFailureKind, message: string) { super(message) }
}

export function apiFailureKind(error: unknown, status?: number, code?: string): ApiFailureKind {
    const seen = new Set<object>()
    let current = error
    for (let depth = 0; depth < 6 && current && typeof current === 'object' && !seen.has(current); depth++) {
        seen.add(current)
        if (current instanceof ApiTransportError) return current.kind
        const item = current as {name?: unknown; code?: unknown; cause?: unknown}
        if (item.name === 'TimeoutError' || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'].includes(String(item.code))) return 'TIMEOUT'
        if (item.name === 'AbortError' || item.code === 'ABORT_ERR') return 'ABORTED'
        if (item.name === 'SyntaxError') return 'INVALID_RESPONSE'
        current = item.cause
    }
    if (code) return 'API_ERROR'
    if (status && status >= 400) return 'HTTP_ERROR'
    if (status && status >= 200) return 'INVALID_RESPONSE'
    return error instanceof Error ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR'
}

export function apiDebugPath(path: string) {
    try { return new URL(path, 'http://local').pathname } catch { return '[invalid-path]' }
}
