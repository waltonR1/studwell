// 账号基础业务能力：规范用户名、投影账号并协调账号操作。
import {entityVersionSchema} from '#shared/schemas/entity.ts'
import {resolvePasswordPolicy} from '../parameter-values'
// 账号基础服务：账号管理服务复用；HTTP 在管理服务复核授权；高风险更新与 Session 撤销保持同一事务。
import {z} from 'zod'
import {userExtraFields, usernameSchema} from '#shared/schemas/admin/users.ts'
import type {Database, DatabaseTransaction} from '../../db/transaction'
import {authRepository} from '../../repositories/auth'
import {accountRepository, type AccountRow} from '../../repositories/accounts'
import {ApiError, conflictError} from '../../core/errors'
import {databaseConflictField, databaseConflictReason} from '../../core/db-errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../../core/validation'
import {validateAccountDictionaryFields} from '../account-dictionaries'
import {hashPassword} from './password'

export function normalizeUsername(value: string) {
    const result = usernameSchema.safeParse(value)
    if (!result.success) throw new ApiError('INVALID_INPUT')
    return result.data
}

export function accountDto(row: AccountRow) {
    return {
        id: String(row.id),
        username: row.username,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        department: row.department,
        position: row.position,
        remark: row.remark,
        isRoot: row.isRoot,
        enabled: row.enabled,
        mustChangePassword: row.mustChangePassword,
        version: row.version,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        createdBy: row.createdBy === null ? null : String(row.createdBy),
        updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
        deletedAt: row.deletedAt?.toISOString() ?? null
    }
}

const profileSchema = z.strictObject({
    displayName: z.string().trim().min(1).max(80),
    email: z.email().max(254).nullable().optional(), ...userExtraFields
})

export function createAccountService(database: Database, checkBlocklist?: boolean, executor?: DatabaseTransaction) {
    const context = executor ?? database

    async function encode(password: string) {
        const policy = await resolvePasswordPolicy(context);
        return hashPassword(password, checkBlocklist ?? policy.blocklistEnabled, policy)
    }

    return {
        async createOrdinary(input: {
            username: string;
            displayName: string;
            email?: string | null;
            phone?: string | null;
            department?: string | null;
            position?: string | null;
            remark?: string | null;
            password: string
        }, actorId: string) {
            const username = normalizeUsername(input.username)
            if (username === 'root') throw new ApiError('FORBIDDEN')
            const profile = await parseInput(profileSchema, {
                displayName: input.displayName,
                email: input.email,
                phone: input.phone,
                department: input.department,
                position: input.position,
                remark: input.remark
            })
            const actor = BigInt(await parseInput(entityIdSchema, actorId))
            const passwordHash = await encode(input.password)
            try {
                await validateAccountDictionaryFields(context, profile)
                const row = await accountRepository.insert(context, {
                    username, ...profile,
                    passwordHash,
                    isRoot: false,
                    createdBy: actor,
                    updatedBy: actor
                })
                if (!row) throw new ApiError('INTERNAL_ERROR')
                return accountDto(row)
            } catch (error) {
                const reason = databaseConflictReason(error)
                if (reason) throw conflictError(reason, reason === 'DUPLICATE' ? 'username' : databaseConflictField(reason))
                throw error
            }
        },
        async updateOrdinary(id: string, version: number, actorId: string, input: unknown) {
            const schema = profileSchema.partial().extend({enabled: z.boolean().optional()}).strict()
            const changes = await parseInput(schema, input)
            await update(id, version, actorId, changes)
        },
        async resetOrdinaryPassword(id: string, version: number, actorId: string, password: string) {
            await update(id, version, actorId, {passwordHash: await encode(password), mustChangePassword: true})
        },
        async softDeleteOrdinary(id: string, version: number, actorId: string) {
            await update(id, version, actorId, {deletedAt: new Date(), enabled: false})
        },
    }

    async function update(id: string, version: number, actorId: string, changes: Parameters<typeof accountRepository.updateOrdinary>[4]) {
        const key = BigInt(await parseInput(entityIdSchema, id))
        const actor = BigInt(await parseInput(entityIdSchema, actorId))
        await parseInput(entityVersionSchema, version)
        const perform = async (tx: DatabaseTransaction) => {
            const row = await accountRepository.findById(tx, key, true)
            if (!row || row.deletedAt) throw new ApiError('NOT_FOUND')
            if (row.isRoot) throw new ApiError('FORBIDDEN')
            await validateAccountDictionaryFields(tx, changes, row)
            if (!await accountRepository.updateOrdinary(tx, key, version, actor, changes)) throw conflictError('STALE', 'version')
            if (changes.enabled === false || changes.passwordHash || changes.deletedAt) await authRepository.revokeUser(tx, key)
        }
        try {
            if (executor) await perform(executor)
            else await database.transaction(perform)
        } catch (error) {
            const reason = databaseConflictReason(error)
            if (reason) throw conflictError(reason, databaseConflictField(reason))
            throw error
        }
    }
}
