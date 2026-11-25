import {describe, expect, it, vi} from 'vitest'
import {requireLogResult} from '../../server/policies/log-result'
import {auditRepository, type AuditInput} from '../../server/repositories/audit'
import {authRepository} from '../../server/repositories/auth'
import type {DatabaseExecutor} from '../../server/db/transaction'

describe('日志结果边界', () => {
    it('按日志分类校验，拒绝未知值且不静默转换', () => {
        for (const kind of ['login', 'audit', 'security'] as const) {
            expect(requireLogResult('success', kind)).toBe('success')
            expect(requireLogResult('failed', kind)).toBe('failed')
            for (const result of ['SUCCESS', 'success ', '', 'unknown', null]) {
                expect(() => requireLogResult(result, kind)).toThrow(expect.objectContaining({code: 'INTERNAL_ERROR'}))
            }
        }
        expect(requireLogResult('denied', 'security')).toBe('denied')
        expect(() => requireLogResult('denied', 'login')).toThrow()
        expect(() => requireLogResult('denied', 'audit')).toThrow()
    })

    it('运行时非法写入在执行 SQL 前被拒绝', async () => {
        const values = vi.fn(), db = {insert: vi.fn(() => ({values}))} as unknown as DatabaseExecutor
        await expect(auditRepository.audit(db, {result: 'unknown'} as unknown as AuditInput)).rejects.toMatchObject({code: 'INTERNAL_ERROR'})
        await expect(authRepository.log(db, {action: 'login', result: 'denied'} as Parameters<typeof authRepository.log>[1])).rejects.toMatchObject({code: 'INTERNAL_ERROR'})
        expect(values).not.toHaveBeenCalled()
    })
})
