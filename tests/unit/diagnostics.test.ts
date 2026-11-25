import {afterEach, describe, expect, it, vi} from 'vitest'
import {diagnosticErrors, reportDiagnostic, forwardTaskDiagnostic, createDiagnosticLimiter, workerStartupError} from '../../server/infrastructure/diagnostics'
import {ApiError, conflictError} from '../../server/core/errors'
import {auditService} from '../../server/services/audit'
import {auditRepository} from '../../server/repositories/audit'
import type {DatabaseExecutor} from '../../server/db/transaction'

afterEach(() => vi.restoreAllMocks())
describe('错误诊断与日志关联', () => {
    it('敏感字段的驼峰、下划线和连字符写法及独立哈希均脱敏', () => {
        const fields = ['passwordHash', 'password_hash', 'password-hash', 'apiKey', 'api_key', 'api-key', 'privateKey', 'accessToken', 'refresh_token', 'clientSecret', 'connectionString', 'database_url']
        for (const field of fields) {
            const output = JSON.stringify(diagnosticErrors(new Error(`{"${field}":"PRIVATE_VALUE"}`)))
            expect(output).not.toContain('PRIVATE_VALUE')
        }
        expect(JSON.stringify(diagnosticErrors(new Error('$argon2id$v=19$m=65536,t=3,p=1$PRIVATE_SALT$PRIVATE_HASH')))).not.toMatch(/PRIVATE/)
    })
    it('同一请求的同一异常只记录一次完整详情，其他阶段保留关联编号', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {}), info = vi.spyOn(console, 'info').mockImplementation(() => {})
        const cause = new Error('ORIGINAL')
        reportDiagnostic('operation_failure', 'request-duplicate', cause, {logId: '123'})
        reportDiagnostic('api', 'request-duplicate', cause)
        expect(error).toHaveBeenCalledTimes(1)
        const original = JSON.parse(error.mock.calls[0]![0]), related = JSON.parse(info.mock.calls[0]![0])
        expect(original.errors).toHaveLength(1)
        expect(related).toMatchObject({level: 'info', stage: 'api', relatedDiagnosticId: original.diagnosticId})
        expect(related.errors).toBeUndefined()
        reportDiagnostic('api', 'another-request', cause)
        expect(error).toHaveBeenCalledTimes(2)
    })
    it('业务冲突与受控拒绝使用 warn，不重复携带堆栈', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}), error = vi.spyOn(console, 'error').mockImplementation(() => {})
        reportDiagnostic('operation_failure', 'request-business', conflictError('STALE'))
        reportDiagnostic('operation_failure', 'request-auth', new ApiError('AUTH_FAILED'))
        expect(warn).toHaveBeenCalledTimes(2); expect(error).not.toHaveBeenCalled()
        expect(JSON.parse(warn.mock.calls[0]![0])).toMatchObject({level: 'warn', reason: 'STALE', errors: [{stack: []}]})
    })
    it('任务限频不会压住其他执行或原因，下一次报告携带省略次数', () => {
        let now = 0
        const allow = createDiagnosticLimiter(60000, () => now), cause = new Error('connection lost')
        expect(allow(cause, 'run-1')).toEqual({suppressedCount: 0})
        expect(allow(cause, 'run-1')).toBeUndefined()
        expect(allow(cause, 'run-2')).toEqual({suppressedCount: 0})
        expect(allow(new Error('lease update failed'), 'run-1')).toEqual({suppressedCount: 0})
        now = 60000
        expect(allow(cause, 'run-1')).toEqual({suppressedCount: 1})
    })
    it('启动错误只提取类型、错误码及已知语法原因，不转发原始文本', () => {
        expect(workerStartupError('Error [ERR_MODULE_NOT_FOUND]: PRIVATE_PATH')).toMatchObject({name: 'Error', code: 'ERR_MODULE_NOT_FOUND'})
        expect(workerStartupError("Error: Cannot find module 'PRIVATE_PATH'")).toMatchObject({code: 'MODULE_NOT_FOUND', message: 'Cannot find module'})
        const syntax = workerStartupError('SyntaxError: Unexpected token PRIVATE_VALUE')
        expect(syntax).toMatchObject({name: 'SyntaxError', message: 'Unexpected token'})
        expect(JSON.stringify(syntax)).not.toContain('PRIVATE_VALUE')
        expect(workerStartupError('password=PRIVATE_VALUE')).toBeUndefined()
    })
    it('保留错误链与位置，过滤 SQL、驱动业务值和凭据', () => {
        const driver = Object.assign(new Error("Duplicate entry 'PRIVATE_VALUE'"), {code: 'ER_DUP_ENTRY', sql: 'PRIVATE_SQL'})
        const wrapped = new Error('Failed query: PRIVATE_SQL parameters: PRIVATE_VALUE', {cause: driver})
        const errors = diagnosticErrors(wrapped)
        expect(errors).toHaveLength(2)
        expect(errors[1]?.code).toBe('ER_DUP_ENTRY')
        expect(errors[0]?.stack.join(' ')).toContain('diagnostics.test.ts')
        expect(JSON.stringify(errors)).not.toMatch(/PRIVATE_VALUE|PRIVATE_SQL/)
        const json = diagnosticErrors(new Error('{"password":"PRIVATE_PASSWORD", "token":"PRIVATE_TOKEN"} Authorization: Bearer PRIVATE_AUTH'))
        expect(JSON.stringify(json)).not.toMatch(/PRIVATE_PASSWORD|PRIVATE_TOKEN|PRIVATE_AUTH/)
        const detail = diagnosticErrors(new Error('file missing password=PRIVATE_PASSWORD token=PRIVATE_TOKEN mysql://user:PRIVATE_DB@host/db'))
        expect(detail[0]?.message).toContain('file missing')
        expect(JSON.stringify(detail)).not.toMatch(/PRIVATE_PASSWORD|PRIVATE_TOKEN|PRIVATE_DB/)
    })
    it('循环 cause、有界长度及非 Error 抛出不会中断错误响应', () => {
        const cyclic = Object.assign(new Error('broken'), {cause: {} as unknown})
        cyclic.cause = cyclic
        expect(diagnosticErrors(cyclic)).toHaveLength(1)
        expect(diagnosticErrors('TASK_BROKEN')[0]?.message).toBe('TASK_BROKEN')
        expect(diagnosticErrors(null)[0]?.name).toBe('NonError')
        expect(diagnosticErrors(new Error('x'.repeat(5000)))[0]?.message.length).toBe(2000)
    })
    it('任务转发保留原因、阶段与关联编号，拒绝其他请求和非诊断事件', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        reportDiagnostic('audit_failure', 'request-1', Object.assign(new Error('connection lost'), {code: 'ECONNRESET'}), {logId: '123'})
        const event = JSON.parse(log.mock.calls[0]![0])
        log.mockClear()
        expect(forwardTaskDiagnostic(event, 'request-2', '77')).toBe(false)
        expect(forwardTaskDiagnostic({...event, event: 'other'}, 'request-1', '77')).toBe(false)
        expect(log).not.toHaveBeenCalled()
        expect(forwardTaskDiagnostic(event, 'request-1', '77')).toBe(true)
        expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({stage: 'audit_failure', reason: 'ECONNRESET', requestId: 'request-1', runId: '77', logId: '123', errors: [{code: 'ECONNRESET', message: 'connection lost'}]})
    })
    const input = {action: 'users.update', targetType: 'user', result: 'failed' as const, requestId: 'request-1', ip: 'local', userAgent: 'fixture', createdAt: new Date()}
    it('失败日志入库成功后，输出真实记录 ID 和原始异常', async () => {
        vi.spyOn(auditRepository, 'audit').mockResolvedValue(2026103001000000001n)
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        await auditService.failure({} as DatabaseExecutor, input, new Error('FILE_MISSING'))
        expect(JSON.parse(log.mock.calls[0]![0])).toMatchObject({stage: 'operation_failure', requestId: 'request-1', logId: '2026103001000000001', errors: [{message: 'FILE_MISSING'}]})
    })
    it('入库失败仍留下原始业务异常及入库异常，不宣称存在记录 ID', async () => {
        vi.spyOn(auditRepository, 'audit').mockRejectedValue(Object.assign(new Error('connection failed'), {code: 'ECONNRESET'}))
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        await expect(auditService.failure({} as DatabaseExecutor, input, new Error('ORIGINAL_FAILURE'))).rejects.toMatchObject({code: 'INTERNAL_ERROR'})
        const events = log.mock.calls.map(call => JSON.parse(call[0]))
        expect(events).toEqual(expect.arrayContaining([expect.objectContaining({stage: 'audit_failure', reason: 'ECONNRESET'}), expect.objectContaining({stage: 'operation_failure', errors: [expect.objectContaining({message: 'ORIGINAL_FAILURE'})]})]))
        expect(events.every(event => event.logId === undefined)).toBe(true)
    })
})
