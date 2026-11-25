// 协调认证与会话业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {reportDiagnostic} from '../infrastructure/diagnostics'
import type {LogResult} from '#shared/types/admin/logs'
import {resolveRatePolicy, resolveSessionPolicy, resolvePasswordPolicy} from './parameter-values'
import {logFailureReason} from '../policies/log-reasons'
import {rateLimitNames} from '#shared/config/admin/logs.ts'
import {type LogReasonCode} from '#shared/types/admin/logs'
// 认证规则、Session 生命周期、限流与安全事件；通过 Repository 组织事务。
import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto'
import type {Database} from '../db/transaction'
import {accountRepository} from '../repositories/accounts'
import {authRepository as repo} from '../repositories/auth'
import {hashPassword, passwordNeedsRehash, verifyPassword} from './accounts/password'
import {ApiError, conflictError} from '../core/errors'

export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const csrfToken = (raw: string) => createHmac('sha256', raw).update('studwell-csrf').digest('hex')

export function safeTokenEqual(a: string, b: string) {
    return /^[a-f0-9]{64}$/.test(a) && /^[a-f0-9]{64}$/.test(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

import type {AuthMeta} from '../core/auth-context'

let dummyHash: Promise<string> | undefined

export function createAuthService(db: Database, clock = () => new Date(), checkBlocklist?: boolean) {
    async function log(action: string, result: LogResult, meta: AuthMeta, userId?: bigint, username?: string, reasonCode?: LogReasonCode, original?: unknown) {
        try {
            const id = await repo.log(db, {...meta, action, result, userId, username, reasonCode, createdAt: clock()})
            if (original !== undefined) reportDiagnostic('operation_failure', meta.requestId, original, {logId: String(id)})
            return id
        } catch (cause) {
            reportDiagnostic('audit_failure', meta.requestId, cause)
            if (original !== undefined) reportDiagnostic('operation_failure', meta.requestId, original)
            throw new ApiError('INTERNAL_ERROR')
        }
    }

    async function limit(scope: string, identity: string, meta: AuthMeta) {
        const policy = await resolveRatePolicy(db, scope)
        if (!Object.hasOwn(rateLimitNames, scope)) throw new ApiError('INVALID_INPUT')
        const maximum = policy.count, windowMs = policy.windowMs
        const now = clock()
        const bucket = createHash('sha256').update(JSON.stringify([scope, policy.revision, maximum, windowMs, identity])).digest('hex')
        const row = await db.transaction(tx => repo.consume(tx, bucket, now, new Date(now.getTime() - windowMs)))
        if (row.hits > maximum) {
            if (row.hits === maximum + 1) await log('rate_limit', 'denied', {
                ...meta,
                rateLimitScope: Object.hasOwn(rateLimitNames, scope) ? scope : undefined
            }, undefined, undefined, 'RATE_LIMIT')
            throw new ApiError('RATE_LIMITED', undefined, Math.max(1, Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000)))
        }
    }

    async function resolve(raw: string | undefined) {
        if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null
        const session = await repo.session(db, tokenHash(raw))
        if (!session) return null
        const now = clock().getTime()
        if (now >= session.expiresAt.getTime() || now - session.lastActivityAt.getTime() >= session.idleTimeoutMs) {
            await repo.deleteSession(db, session.tokenHash)
            return null
        }
        const user = session.userId === null ? undefined : await repo.user(db, session.userId)
        if (session.userId !== null && (!user || !user.enabled || user.deletedAt)) {
            await repo.deleteSession(db, session.tokenHash)
            return null
        }
        return {session, user}
    }

    async function newSession(tx: Parameters<Parameters<Database['transaction']>[0]>[0], userId?: bigint) {
        const policy = await resolveSessionPolicy(tx)
        const now = clock(), raw = randomBytes(32).toString('hex')
        await repo.insertSession(tx, {
            tokenHash: tokenHash(raw),
            userId,
            idleTimeoutMs: userId === undefined ? policy.anonymousMs : policy.idleMs,
            createdAt: now,
            lastActivityAt: now,
            expiresAt: new Date(now.getTime() + (userId === undefined ? policy.anonymousMs : policy.absoluteMs))
        })
        return raw
    }

    return {
        resolve, limit, log,
        async passwordPolicy() {
            const policy = await resolvePasswordPolicy(db);
            return {minLength: policy.minLength, maxLength: policy.maxLength}
        },
        async bootstrap(raw: string | undefined, meta: AuthMeta) {
            const current = await resolve(raw)
            if (current && raw) return {raw, current}
            await limit('bootstrap', meta.ip, meta)
            const next = await db.transaction(tx => newSession(tx))
            return {raw: next, current: (await resolve(next))!}
        },
        async login(raw: string, username: string, password: string, meta: AuthMeta) {
            await limit('login-ip', meta.ip, meta)
            await limit('login-account', username, meta)
            let user: Awaited<ReturnType<typeof accountRepository.findByUsername>>
            let loginReason: LogReasonCode | undefined
            try {
                user = await accountRepository.findByUsername(db, username)
                dummyHash ??= hashPassword('Internal dummy verifier 928471!', false)
                const verified = await verifyPassword(user?.passwordHash ?? await dummyHash, password)
                if (!user || !verified || !user.enabled || user.deletedAt) {
                    loginReason = user && (!user.enabled || user.deletedAt) ? 'ACCOUNT_UNAVAILABLE' : 'CREDENTIALS_INVALID'
                    throw new ApiError('AUTH_FAILED')
                }
                const upgradedHash = passwordNeedsRehash(user.passwordHash) ? await hashPassword(password, false) : undefined
                const loginUser = user
                return await db.transaction(async tx => {
                    const lockedUser = await repo.user(tx, loginUser.id, true)
                    const session = await repo.session(tx, tokenHash(raw), true)
                    if (!lockedUser?.enabled || lockedUser.deletedAt || lockedUser.version !== loginUser.version) {
                        loginReason = 'LOGIN_STATE_CHANGED';
                        throw new ApiError('AUTH_FAILED')
                    }
                    if (!session || session.userId !== null || clock() >= session.expiresAt) {
                        loginReason = 'LOGIN_SESSION_INVALID';
                        throw new ApiError('AUTH_FAILED')
                    }
                    if (upgradedHash) {
                        // 参数升级只替换同一密码的哈希，不清除首次改密要求。
                        await accountRepository.rehash(tx, loginUser.id, upgradedHash)
                    }
                    await repo.deleteSession(tx, session.tokenHash)
                    const next = await newSession(tx, loginUser.id)
                    await repo.log(tx, {
                        ...meta,
                        userId: loginUser.id,
                        username,
                        action: 'login',
                        result: 'success',
                        createdAt: clock()
                    })
                    return {
                        raw: next,
                        mustChangePassword: lockedUser.mustChangePassword,
                        expiresAt: (await repo.session(tx, tokenHash(next)))!.expiresAt
                    }
                })
            } catch (cause) {
                await log('login', 'failed', meta, user?.id, username, loginReason ?? logFailureReason(cause), cause)
                throw cause
            }
        },
        async logout(raw: string, meta: AuthMeta) {
            const current = await resolve(raw)
            await db.transaction(async tx => {
                await repo.deleteSession(tx, tokenHash(raw))
                await repo.log(tx, {
                    ...meta,
                    userId: current?.user?.id,
                    username: current?.user?.username,
                    action: 'logout',
                    result: 'success',
                    createdAt: clock()
                })
            })
        },
        async changePassword(raw: string, oldPassword: string, newPassword: string, meta: AuthMeta) {
            const current = await resolve(raw)
            if (!current?.user) throw new ApiError('UNAUTHENTICATED')
            const user = current.user
            await limit('change-password', String(user.id), meta)
            let failureReason: LogReasonCode | undefined
            try {
                const oldValid = await verifyPassword(user.passwordHash, oldPassword)
                if (!oldValid || oldPassword === newPassword) {
                    failureReason = !oldValid ? 'OLD_PASSWORD_INVALID' : 'PASSWORD_UNCHANGED'
                    throw new ApiError('AUTH_FAILED')
                }
                const policy = await resolvePasswordPolicy(db)
                let passwordHash: string
                try { passwordHash = await hashPassword(newPassword, checkBlocklist ?? policy.blocklistEnabled, policy) }
                catch (cause) {
                    if (cause instanceof ApiError && cause.code === 'INVALID_INPUT') failureReason = 'PASSWORD_POLICY'
                    throw cause
                }
                await db.transaction(async tx => {
                    const locked = await repo.user(tx, user.id, true)
                    const session = await repo.session(tx, tokenHash(raw), true)
                    if (!locked?.enabled || locked.deletedAt || !session || clock() >= session.expiresAt || clock().getTime() - session.lastActivityAt.getTime() >= session.idleTimeoutMs) throw new ApiError('UNAUTHENTICATED')
                    if (!await repo.replacePassword(tx, user.id, user.version, passwordHash, clock())) throw conflictError('STALE', 'version')
                    await repo.revokeUser(tx, user.id)
                    await repo.log(tx, {
                        ...meta,
                        userId: user.id,
                        username: user.username,
                        action: 'password_change',
                        result: 'success',
                        createdAt: clock()
                    })
                })
            } catch (cause) {
                await log('password_change', 'failed', meta, user.id, user.username, failureReason ?? logFailureReason(cause), cause)
                throw cause
            }
        },
        async touch(raw: string) {
            await repo.touch(db, tokenHash(raw), clock())
        },
    }
}
