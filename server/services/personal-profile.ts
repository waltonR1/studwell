// 协调当前账号资料读取与更新，不处理 Cookie 或界面状态。
import type {Database, DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {accountRepository} from '../repositories/accounts'
import {personalProfileSchema} from '#shared/schemas/admin/users.ts'
import {parseInput} from '../core/validation'
import {ApiError, conflictError} from '../core/errors'
import {auditChanges} from '../policies/audit-changes'
import {auditService} from './audit'
import {readAccountDictionaryCatalog, validateAccountDictionaryFields} from './account-dictionaries'

export function createPersonalProfileService(db: Database) {
    async function current(actor: bigint, lock = false, tx: DatabaseExecutor = db) {
        const row = await accountRepository.findById(tx, actor, lock)
        if (!row || !row.enabled || row.deletedAt) throw new ApiError('UNAUTHENTICATED')
        if (row.mustChangePassword) throw new ApiError('PASSWORD_CHANGE_REQUIRED')
        return row
    }

    const dto = (row: Awaited<ReturnType<typeof current>>) => ({
        username: row.username,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        department: row.department,
        position: row.position,
        version: row.version,
        isRoot: row.isRoot
    })
    return {
        async read(actor: bigint) {
            return {...dto(await current(actor)), dictionaryCatalog: await readAccountDictionaryCatalog(db)}
        },
        async update(actor: bigint, input: unknown, meta: AuthMeta) {
            try {
                const {version, ...changes} = await parseInput(personalProfileSchema, input)
                const dictionaryCatalog = await readAccountDictionaryCatalog(db)
                const updated = await db.transaction(async tx => {
                    const row = await current(actor, true, tx)
                    if (row.isRoot) throw new ApiError('FORBIDDEN')
                    await validateAccountDictionaryFields(tx, changes, row)
                    if (!await accountRepository.updateOrdinary(tx, actor, version, actor, changes)) throw conflictError('STALE', 'version')
                    await auditService.write(tx, {
                        ...meta,
                        actorId: actor,
                        action: 'users.profile',
                        targetType: 'user',
                        targetId: String(actor),
                        targetName: row.username,
                        changeContext: auditChanges('user', row, {...row, ...changes}),
                        result: 'success',
                        createdAt: new Date()
                    })
                    return current(actor, false, tx)
                })
                return {...dto(updated), dictionaryCatalog}
            } catch (error) {
                await auditService.failure(db, {
                    ...meta,
                    actorId: actor,
                    action: 'users.profile',
                    targetType: 'user',
                    targetId: String(actor),
                    result: 'failed',
                    createdAt: new Date()
                }, error)
                throw error
            }
        },
    }
}
