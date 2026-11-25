import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest'
import {createAuthService} from '../../server/services/auth'
import {createMediaService} from '../../server/services/media'
import {authRepository} from '../../server/repositories/auth'
import {accountRepository} from '../../server/repositories/accounts'
import {auditRepository} from '../../server/repositories/audit'
import {hashPassword, verifyPassword, passwordNeedsRehash} from '../../server/services/accounts/password'
import type {Database, DatabaseExecutor} from '../../server/db/transaction'
import type {MediaStorage} from '../../server/core/media-storage'
vi.mock('../../server/services/accounts/password', () => ({hashPassword: vi.fn(), verifyPassword: vi.fn(), passwordNeedsRehash: vi.fn()}))
vi.mock('../../server/services/parameter-values', () => ({
    resolveRatePolicy: vi.fn(async () => ({count: 100, windowMs: 60000, revision: 1})),
    resolvePasswordPolicy: vi.fn(async () => ({blocklistEnabled: false})),
    resolveSessionPolicy: vi.fn(), resolveListPageSize: vi.fn(),
}))
vi.mock('../../server/services/access/permissions', () => ({requirePermission: vi.fn(async () => {})}))
const meta = {requestId: 'request-coverage', ip: 'local', userAgent: 'fixture'}
const user = {id: 1n, username: 'root', passwordHash: '$argon2id$fixture', enabled: true, deletedAt: null, version: 1} as NonNullable<Awaited<ReturnType<typeof authRepository.user>>>
function database() {
    return {transaction: vi.fn(async (work: (tx: DatabaseExecutor) => Promise<unknown>) => work({} as DatabaseExecutor))} as unknown as Database
}
beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.mocked(hashPassword).mockReset().mockResolvedValue('hash')
    vi.mocked(verifyPassword).mockReset().mockResolvedValue(true)
    vi.mocked(passwordNeedsRehash).mockReset().mockReturnValue(false)
    vi.spyOn(accountRepository, 'findByUsername').mockResolvedValue(user)
    vi.spyOn(authRepository, 'consume').mockResolvedValue({key: 'fixture', hits: 1, windowStart: new Date()})
    vi.spyOn(authRepository, 'log').mockResolvedValue(123n)
    vi.spyOn(auditRepository, 'audit').mockResolvedValue(456n)
})
afterEach(() => vi.restoreAllMocks())
describe('技术准备阶段失败审计', () => {
    it('登录校验器异常补写一条失败记录并保留原异常', async () => {
        const cause = new Error('VERIFIER_FAILED')
        vi.mocked(verifyPassword).mockRejectedValueOnce(cause)
        await expect(createAuthService(database()).login('a'.repeat(64), 'root', 'PRIVATE', meta)).rejects.toBe(cause)
        expect(authRepository.log).toHaveBeenCalledTimes(1)
        expect(vi.mocked(authRepository.log).mock.calls[0]?.[1]).toMatchObject({action: 'login', result: 'failed', reasonCode: 'INTERNAL_ERROR', userId: 1n, requestId: meta.requestId})
    })
    it('哈希升级异常补写一条失败记录', async () => {
        const cause = new Error('HASH_UPGRADE_FAILED')
        vi.mocked(passwordNeedsRehash).mockReturnValue(true)
        vi.mocked(hashPassword).mockImplementation(async password => {
            if (password.startsWith('Internal dummy')) return 'hash'
            throw cause
        })
        await expect(createAuthService(database()).login('a'.repeat(64), 'root', 'PRIVATE', meta)).rejects.toBe(cause)
        expect(authRepository.log).toHaveBeenCalledTimes(1)
        expect(vi.mocked(authRepository.log).mock.calls[0]?.[1]).toMatchObject({action: 'login', reasonCode: 'INTERNAL_ERROR'})
    })
    it('普通凭据错误不会因扩大捕获范围重复入库', async () => {
        vi.mocked(verifyPassword).mockResolvedValue(false)
        await expect(createAuthService(database()).login('a'.repeat(64), 'root', 'PRIVATE', meta)).rejects.toMatchObject({code: 'AUTH_FAILED'})
        expect(authRepository.log).toHaveBeenCalledTimes(1)
        expect(vi.mocked(authRepository.log).mock.calls[0]?.[1]).toMatchObject({reasonCode: 'CREDENTIALS_INVALID'})
    })
    it('改密校验器异常保存安全失败记录', async () => {
        const cause = new Error('VERIFIER_FAILED'), now = new Date()
        vi.spyOn(authRepository, 'session').mockResolvedValue({userId: 1n, tokenHash: 'hash', lastActivityAt: now, expiresAt: new Date(now.getTime() + 60000), idleTimeoutMs: 60000} as NonNullable<Awaited<ReturnType<typeof authRepository.session>>>)
        vi.spyOn(authRepository, 'user').mockResolvedValue(user)
        vi.mocked(verifyPassword).mockRejectedValue(cause)
        await expect(createAuthService(database()).changePassword('a'.repeat(64), 'PRIVATE_OLD', 'PRIVATE_NEW', meta)).rejects.toBe(cause)
        expect(authRepository.log).toHaveBeenCalledTimes(1)
        expect(vi.mocked(authRepository.log).mock.calls[0]?.[1]).toMatchObject({action: 'password_change', reasonCode: 'INTERNAL_ERROR'})
    })
    it('首次文件写入失败也保存一条媒体操作审计', async () => {
        const cause = Object.assign(new Error('disk full'), {code: 'ENOSPC'})
        const storage = {put: vi.fn().mockRejectedValue(cause), remove: vi.fn()} as unknown as MediaStorage
        const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNCcAAAAASUVORK5CYII=', 'base64')
        await expect(createMediaService(database(), storage).upload(1n, {name: 'fixture', remark: ''}, {bytes, filename: 'fixture.png', mime: 'image/png'}, meta)).rejects.toBe(cause)
        expect(auditRepository.audit).toHaveBeenCalledTimes(1)
        expect(vi.mocked(auditRepository.audit).mock.calls[0]?.[1]).toMatchObject({action: 'media.create', result: 'failed', targetName: 'fixture', reasonCode: 'INTERNAL_ERROR'})
        expect(storage.remove).not.toHaveBeenCalled()
    })
})
