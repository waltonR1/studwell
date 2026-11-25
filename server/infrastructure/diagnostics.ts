// 服务端诊断保留受限异常链与调用位置；不记录 SQL、参数或请求内容。
import {randomUUID} from 'node:crypto'
import {ApiError, ConfigurationError} from '../core/errors'
import {databaseConflictReason} from '../core/db-errors'

const infrastructure = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ER_CON_COUNT_ERROR', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', 'ENOENT', 'ENOSPC', 'EACCES', 'EPERM', 'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'])

export function diagnosticReason(cause: unknown): string {
    const conflict = databaseConflictReason(cause)
    if (conflict) return conflict
    if (cause instanceof ConfigurationError) return cause.diagnosticCode
    if (cause instanceof ApiError) return cause.reason ?? cause.code
    const seen = new Set<object>()
    let current = cause
    for (let depth = 0; depth < 6 && current && typeof current === 'object' && !seen.has(current); depth++) {
        seen.add(current)
        const item = current as { code?: unknown; cause?: unknown }
        if (typeof item.code === 'string' && infrastructure.has(item.code)) return item.code
        current = item.cause
    }
    return 'UNEXPECTED'
}

// 驱动消息可能携带 SQL 和业务值；只保留驱动代码和调用位置。
export function diagnosticErrors(cause: unknown) {
    const errors: Array<{name: string; code?: string; message: string; stack: string[]}> = []
    const seen = new Set<object>()
    let current = cause
    for (let depth = 0; depth < 6 && current && typeof current === 'object' && !seen.has(current); depth++) {
        seen.add(current)
        const item = current as {name?: unknown; message?: unknown; stack?: unknown; code?: unknown; cause?: unknown; sql?: unknown}
        const code = typeof item.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(item.code) ? item.code : undefined
        const database = item.sql !== undefined || code?.startsWith('ER_') || /\b(?:query|sql)\b|parameters:/i.test(String(item.message ?? ''))
        errors.push({name: typeof item.name === 'string' ? diagnosticText(item.name).slice(0, 80) : 'Error', code,
            message: database ? 'Database operation failed (see code and cause)' : diagnosticText(typeof item.message === 'string' ? item.message : 'Non-Error exception'),
            stack: typeof item.stack === 'string' ? item.stack.split('\n').filter(line => /^\s+at /.test(line)).slice(0, 12).map(line => diagnosticText(line).slice(0, 500)) : []})
        current = item.cause
    }
    if (!errors.length) errors.push({name: 'NonError', message: typeof cause === 'string' && !/\b(?:query|sql)\b|parameters:/i.test(cause) ? diagnosticText(cause) : 'Non-Error exception', stack: []})
    return errors
}

export function diagnosticText(value: string) {
    return value.replace(/((?:authorization|cookie)["']?\s*[=:]\s*)[^\r\n]+/gi, '$1[redacted]')
        .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
        .replace(/(?:https?|mysql):\/\/[^\s)]+/gi, '[redacted-url]')
        .replace(/((?:password(?:[_-]?hash)?|passwd|pwd|(?:api|private)[_-]?key|(?:access|refresh|csrf|session)[_-]?token|token|(?:client[_-]?)?secret|authorization|cookie|database[_-]?url|connection[_-]?string)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[redacted]')
        .replace(/\$argon2(?:id|i|d)\$[^\s"']+/gi, '[redacted-hash]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-token]')
        .replace(/\b[a-f0-9]{64}\b/gi, '[redacted-token]').slice(0, 2000)
}

const reported = new WeakMap<object, Map<string, string>>()
type DiagnosticContext = {logId?: string; runId?: string; exitCode?: number | null; signal?: string | null; suppressedCount?: number}

export function reportDiagnostic(stage: 'media_storage' | 'api' | 'operation_failure' | 'audit_success' | 'audit_failure' | 'parameter_read' | 'log_cleanup' | 'auth_cleanup' | 'task_execution' | 'task_scheduler', requestId: string | undefined, cause: unknown, context: DiagnosticContext = {}) {
    // Request ID 来自统一边界；调用方不能通过此入口扩展任意诊断字段。
    const reason = diagnosticReason(cause)
    const expected = stage === 'operation_failure' && (cause instanceof ApiError && cause.status < 500 || databaseConflictReason(cause) !== null)
    const key = requestId ?? context.runId ?? 'system'
    const previous = cause && typeof cause === 'object' ? reported.get(cause)?.get(key) : undefined
    const diagnosticId = previous ?? randomUUID()
    if (cause && typeof cause === 'object' && !previous) {
        let requests = reported.get(cause)
        if (!requests) { requests = new Map(); reported.set(cause, requests) }
        if (requests.size >= 16) requests.delete(requests.keys().next().value!)
        requests.set(key, diagnosticId)
    }
    const level = previous ? 'info' : expected ? 'warn' : 'error'
    const output = level === 'info' ? console.info : level === 'warn' ? console.warn : console.error
    output(JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        diagnosticId,
        ...(previous ? {relatedDiagnosticId: previous} : {}),
        event: 'admin_diagnostic',
        stage,
        requestId,
        reason,
        errors: previous ? undefined : diagnosticErrors(cause).map(item => expected ? {...item, stack: []} : item),
        ...context,
        ...(reason === 'PARAMETER_SEED_REQUIRED' ? {hint: '系统参数缺失或数据库默认值无效。缺失记录可在目标环境执行 npm run db -- seed system --target dev|test --apply（选择实际目标）。'} : {})
    }))
}

export function reportParameterFallback(key: string) {
    console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'admin_diagnostic',
        stage: 'parameter_read',
        key,
        reason: 'INVALID_OVERRIDE'
    }))
}

// 只转发同一次执行的受控事件，保留 Worker 已生成的分类与异常链。
export function forwardTaskDiagnostic(event: Record<string, unknown>, requestId: string, runId: string) {
    if (event.event !== 'admin_diagnostic' || event.requestId !== requestId) return false
    const stages = ['media_storage', 'operation_failure', 'audit_success', 'audit_failure', 'task_execution']
    const level = event.level === 'info' || event.level === 'warn' ? event.level : 'error'
    const output = level === 'info' ? console.info : level === 'warn' ? console.warn : console.error
    output(JSON.stringify({timestamp: new Date().toISOString(), level, event: 'admin_diagnostic',
        diagnosticId: typeof event.diagnosticId === 'string' && /^[a-f0-9-]{36}$/.test(event.diagnosticId) ? event.diagnosticId : undefined,
        relatedDiagnosticId: typeof event.relatedDiagnosticId === 'string' && /^[a-f0-9-]{36}$/.test(event.relatedDiagnosticId) ? event.relatedDiagnosticId : undefined,
        stage: typeof event.stage === 'string' && stages.includes(event.stage) ? event.stage : 'task_execution',
        runId, requestId,
        reason: typeof event.reason === 'string' && /^[A-Z0-9_]{1,64}$/.test(event.reason) ? event.reason : 'UNEXPECTED',
        errors: Array.isArray(event.errors) ? event.errors.slice(0, 6).map(value => {
            const item = value && typeof value === 'object' ? value as Record<string, unknown> : {}
            return {name: typeof item.name === 'string' ? diagnosticText(item.name).slice(0, 80) : 'Error',
                code: typeof item.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(item.code) ? item.code : undefined,
                message: typeof item.message === 'string' ? diagnosticText(item.message) : undefined,
                stack: Array.isArray(item.stack) ? item.stack.filter((line): line is string => typeof line === 'string' && /^\s+at /.test(line)).slice(0, 12).map(line => diagnosticText(line).slice(0, 500)) : []}
        }) : [],
        logId: typeof event.logId === 'string' && /^[1-9]\d{0,19}$/.test(event.logId) ? event.logId : undefined}))
    return true
}

// 同一任务的同类故障合并限频；不同执行或原因的首次故障立即报告。
export function createDiagnosticLimiter(intervalMs: number, clock = Date.now) {
    const entries = new Map<string, {at: number; suppressed: number}>()
    return (cause: unknown, runId = 'scheduler'): {suppressedCount: number} | undefined => {
        const first = diagnosticErrors(cause)[0]
        const key = JSON.stringify([runId, diagnosticReason(cause), first?.code, first?.name, first?.message])
        const now = clock(), previous = entries.get(key)
        if (previous && now - previous.at < intervalMs) { previous.suppressed++; return }
        const result = {suppressedCount: previous?.suppressed ?? 0}
        entries.delete(key)
        if (entries.size >= 256) entries.delete(entries.keys().next().value!)
        entries.set(key, {at: now, suppressed: 0})
        return result
    }
}

// Node 在业务入口执行前的加载/语法异常通常是原生 stderr，只提取类型、代码与登记的原因。
export function workerStartupError(line: string): Error | undefined {
    const match = line.match(/^(?:[A-Za-z]*Error)(?: \[([A-Z0-9_]+)\])?:/)
    if (!match) return
    const name = line.match(/^[A-Za-z]*Error/)![0]
    const missingModule = line.includes('Cannot find module') || line.includes('Cannot find package')
    const code = match[1] ?? (missingModule ? 'MODULE_NOT_FOUND' : undefined)
    const reason = ['Cannot find module', 'Cannot find package', 'Unknown file extension', 'Unexpected token', 'Unexpected identifier', 'Invalid or unexpected token', 'Unexpected end of input', 'Cannot use import statement outside a module'].find(text => line.includes(text))
    const error = Object.assign(new Error(reason ?? 'Worker startup failed; inspect error type and code'), {name, code})
    error.stack = ''
    return error
}
