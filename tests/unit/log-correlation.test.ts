import {describe, expect, it, vi} from 'vitest'
import {MySqlDialect} from 'drizzle-orm/mysql-core'
import {logRepository} from '../../server/repositories/logs'
import {authRepository} from '../../server/repositories/auth'
import {createAuthService} from '../../server/services/auth'
import type {DatabaseExecutor, Database} from '../../server/db/transaction'

describe('日志编号关联', () => {
    it.each(['audit', 'login', 'security'] as const)('%s 查询同时限定请求编号和记录编号', async kind => {
        const where = vi.fn()
        const chain = {from: vi.fn(), leftJoin: vi.fn(), where, orderBy: vi.fn(), limit: vi.fn(), offset: vi.fn().mockResolvedValue([])}
        for (const name of ['from', 'leftJoin', 'where', 'orderBy', 'limit'] as const) chain[name].mockReturnValue(chain)
        const db = {select: () => chain} as unknown as DatabaseExecutor
        await logRepository.rows(db, kind, {period: '7d', start: new Date('2026-10-30'), end: new Date('2026-10-31'), requestId: 'e248c9d2-d617-40ae-9585-99026ba1846f', logId: '2026103001000000001'}, 20, 0)
        const query = new MySqlDialect().sqlToQuery(where.mock.calls[0]![0])
        expect(query.sql).toMatch(/request_id.*=.*and.*id.*=/)
        expect(query.params.map(String)).toEqual(expect.arrayContaining(['e248c9d2-d617-40ae-9585-99026ba1846f', '2026103001000000001']))
    })
    it('认证日志写入失败能保留入库异常和原始操作原因', async () => {
        const write = vi.spyOn(authRepository, 'log').mockRejectedValue(Object.assign(new Error('connection refused'), {code: 'ECONNREFUSED'}))
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            const service = createAuthService({} as Database)
            await expect(service.log('login', 'failed', {ip: 'local', userAgent: 'fixture', requestId: 'request-1'}, 1n, 'root', 'INTERNAL_ERROR', new Error('ORIGINAL_FAILURE'))).rejects.toMatchObject({code: 'INTERNAL_ERROR'})
            expect(log.mock.calls.map(call => JSON.parse(call[0]))).toEqual(expect.arrayContaining([
                expect.objectContaining({stage: 'audit_failure', reason: 'ECONNREFUSED'}),
                expect.objectContaining({stage: 'operation_failure', errors: [expect.objectContaining({message: 'ORIGINAL_FAILURE'})]})
            ]))
        } finally {write.mockRestore(); log.mockRestore()}
    })
})
