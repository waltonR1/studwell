// 协调用户业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {roleGrantScope} from './access/role-scope'
import {requirePermission as checkPermission} from './access/permissions'
import type {LogChangeContext} from '#shared/types/admin/log-changes'
import {auditChanges, auditReferences} from '../policies/audit-changes'
import {auditService} from './audit'
import {resolveListPageSize} from './parameter-values'
// 账号管理协调现有账号服务；授权、关联、会话撤销与审计共用事务。
import {z} from 'zod'
import type {Database, DatabaseExecutor, DatabaseTransaction} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {createAccountService, accountDto} from './accounts'
import {getPermissionSnapshot} from './access/permissions'
import {accountRepository} from '../repositories/accounts'
import {userRepository as repo} from '../repositories/users'
import {ApiError, conflictError} from '../core/errors'
import {databaseConflictField, databaseConflictReason} from '../core/db-errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {listQuerySchema} from '#shared/schemas/admin/pagination'
import {
    userCreateSchema,
    userUpdateSchema,
    userResetSchema,
    userRolesSchema,
    userDeleteSchema
} from '#shared/schemas/admin/users.ts'
import type {UserActions} from '#shared/types/admin/users.ts'
import {readAccountDictionaryCatalog} from './account-dictionaries'

const querySchema = listQuerySchema.safeExtend({status: z.enum(['enabled', 'disabled']).optional()})

export function createUserService(database: Database, checkBlocklist?: boolean) {
    const requirePermission = (actor: bigint, permission: string, executor: DatabaseExecutor = database) => checkPermission(executor, actor, permission)

    async function target(tx: DatabaseExecutor, actor: bigint, raw: string, current: Awaited<ReturnType<typeof getPermissionSnapshot>>, version?: number, allowSelf = false) {
        const id = BigInt(await parseInput(entityIdSchema, raw)),
            row = await accountRepository.findById(tx, id, version !== undefined)
        if (!row || row.deletedAt) throw new ApiError('NOT_FOUND')
        if (row.isRoot || (!allowSelf && actor === id)) throw new ApiError('FORBIDDEN')
        if (version !== undefined && row.version !== version) throw conflictError('STALE', 'version')
        const scope = await roleGrantScope(tx, actor, current, await repo.roleIds(tx, id))
        if ([...scope.values()].some(allowed => !allowed)) throw new ApiError('FORBIDDEN')
        return row
    }

    async function write<T>(actor: bigint, meta: AuthMeta, action: string, id: string | null, permission: string, work: (tx: DatabaseTransaction, current: Awaited<ReturnType<typeof getPermissionSnapshot>>) => Promise<{
        value: T;
        id: string;
        name: string;
        changes: LogChangeContext
    }>) {
        try {
            return await database.transaction(async tx => {
                // 先锁角色再复核授权；READ COMMITTED 避免锁前快照读取旧授权。
                await repo.roles(tx, true)
                const current = await requirePermission(actor, permission, tx), result = await work(tx, current)
                await auditService.write(tx, {
                    ...meta,
                    actorId: actor,
                    action,
                    targetType: 'user',
                    targetId: result.id,
                    targetName: result.name,
                    changeContext: result.changes,
                    result: 'success',
                    createdAt: new Date()
                })
                return result.value
            }, {isolationLevel: 'read committed'})
        } catch (error) {
            await auditService.failure(database, {
                ...meta,
                actorId: actor,
                action,
                targetType: 'user',
                targetId: id,
                result: 'failed',
                createdAt: new Date()
            }, error)
            const reason = databaseConflictReason(error)
            if (reason) throw conflictError(reason, databaseConflictField(reason))
            throw error
        }
    }

    async function detail(actor: bigint, raw: string) {
        const current = await requirePermission(actor, 'system.users.read'),
            id = BigInt(await parseInput(entityIdSchema, raw)), row = await accountRepository.findById(database, id)
        if (!row || row.deletedAt) throw new ApiError('NOT_FOUND')
        const roleIds = await repo.roleIds(database, id)
        const scope = await roleGrantScope(database, actor, current, roleIds)
        const inScope = [...scope.values()].every(Boolean)
        const names = await repo.identities(database, [...new Set([row.createdBy, row.updatedBy].filter((id): id is bigint => id !== null))])
        const relations = await repo.userRoles(database, [id]), logins = await repo.lastLogins(database, [id]),
            sessions = await repo.activeSessions(database, id, new Date())
        return {
            ...accountDto(row),
            roleIds: roleIds.map(String),
            manageable: !row.isRoot && actor !== id && inScope,
            roles: relations.map(role => ({id: String(role.roleId), name: role.name, enabled: role.enabled})),
            lastLoginAt: logins[0]?.at?.toISOString() ?? null,
            activeSessionCount: row.enabled ? sessions.count : 0,
            lastActivityAt: row.enabled ? sessions.lastActivityAt : null,
            actions: actions(actor, current, row, inScope),
            createdByName: names.find(item => item.id === row.createdBy)?.displayName ?? null,
            updatedByName: names.find(item => item.id === row.updatedBy)?.displayName ?? null
        }
    }

    function actions(actor: bigint, current: Awaited<ReturnType<typeof getPermissionSnapshot>>, row: {
        id: bigint;
        isRoot: boolean
    }, inScope: boolean): UserActions {
        const allowed = !row.isRoot && inScope
        const can = (code: string) => current.permissions.includes(code)
        return {
            profile: allowed && row.id !== actor && can('system.users.update'),
            roles: allowed && row.id !== actor && can('system.users.assign_roles'),
            resetPassword: allowed && row.id !== actor && can('system.users.reset_password'),
            delete: allowed && row.id !== actor && can('system.users.delete')
        }
    }

    return {
        detail,
        async list(actor: bigint, input: unknown) {
            const current = await requirePermission(actor, 'system.users.read'),
                parsed = await parseInput(querySchema, input)
            const query = (input as Record<string, unknown>)?.pageSize === undefined ? await parseInput(querySchema, {
                ...(input as Record<string, unknown>),
                pageSize: String(await resolveListPageSize(database))
            }) : parsed
            const result = await repo.list(database, query),
                relations = await repo.userRoles(database, result.items.map(row => row.id))
            const logins = await repo.lastLogins(database, result.items.map(row => row.id))
            const scope = await roleGrantScope(database, actor, current, relations.map(row => row.roleId))
            return {
                ...result,
                items: result.items.map(row => ({
                    ...accountDto(row),
                    roles: relations.filter(link => link.userId === row.id).map(role => ({
                        id: String(role.roleId),
                        name: role.name,
                        enabled: role.enabled
                    })),
                    lastLoginAt: logins.find(login => login.userId === row.id)?.at?.toISOString() ?? null,
                    actions: actions(actor, current, row, relations.filter(link => link.userId === row.id).every(link => scope.get(link.roleId)))
                }))
            }
        },
        async catalog(actor: bigint) {
            const current = await requirePermission(actor, 'system.users.read')
            const roles = await repo.roles(database)
            const scope = await roleGrantScope(database, actor, current, roles.map(role => role.id))
            return roles.map(role => ({id: String(role.id), name: role.name, enabled: role.enabled, grantable: role.enabled && scope.get(role.id)}))
        },
        async profileCatalog(actor: bigint) {
            await requirePermission(actor, 'system.users.read')
            return readAccountDictionaryCatalog(database)
        },
        async create(actor: bigint, input: unknown, meta: AuthMeta) {
            const data = await parseInput(userCreateSchema, input)
            return write(actor, meta, 'users.create', null, 'system.users.create', async tx => {
                const row = await createAccountService(database, checkBlocklist, tx).createOrdinary(data, String(actor))
                return {value: row, id: row.id, name: row.displayName, changes: auditChanges('user', null, row)}
            })
        },
        async update(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const {version, ...data} = await parseInput(userUpdateSchema, input)
            const action = data.enabled !== undefined && Object.keys(data).length === 1 ? (data.enabled ? 'users.enable' : 'users.disable') : 'users.update'
            return write(actor, meta, action, raw, 'system.users.update', async (tx, current) => {
                // 本人资料使用独立的会话身份入口，管理入口不允许修改自己。
                const row = await target(tx, actor, raw, current, version)
                await createAccountService(database, checkBlocklist, tx).updateOrdinary(raw, version, String(actor), data)
                const updated = accountDto((await accountRepository.findById(tx, row.id))!)
                return {value: updated, id: raw, name: updated.displayName, changes: auditChanges('user', row, updated)}
            })
        },
        async assignRoles(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const data = await parseInput(userRolesSchema, input)
            return write(actor, meta, 'users.roles', raw, 'system.users.assign_roles', async (tx, current) => {
                const row = await target(tx, actor, raw, current, data.version), roles = await repo.roles(tx)
                const existing = new Set((await repo.roleIds(tx, row.id)).map(String))
                const scope = await roleGrantScope(tx, actor, current, data.roleIds.map(BigInt))
                for (const id of data.roleIds) {
                    const role = roles.find(role => String(role.id) === id)
                    if (!role || (!role.enabled && !existing.has(id)) || !scope.get(role.id)) throw new ApiError('FORBIDDEN')
                }
                await repo.replace(tx, row.id, data.roleIds.map(BigInt))
                await createAccountService(database, checkBlocklist, tx).updateOrdinary(raw, data.version, String(actor), {})
                return {
                    value: accountDto((await accountRepository.findById(tx, row.id))!),
                    id: raw,
                    name: row.displayName,
                    changes: auditChanges('user', {roles: auditReferences([...existing], roles)}, {roles: auditReferences(data.roleIds, roles)})
                }
            })
        },
        async resetPassword(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const data = await parseInput(userResetSchema, input)
            return write(actor, meta, 'users.reset_password', raw, 'system.users.reset_password', async (tx, current) => {
                const row = await target(tx, actor, raw, current, data.version)
                await createAccountService(database, checkBlocklist, tx).resetOrdinaryPassword(raw, data.version, String(actor), data.password)
                return {
                    value: accountDto((await accountRepository.findById(tx, row.id))!),
                    id: raw,
                    name: row.displayName,
                    changes: auditChanges('user', {passwordReset: null, mustChangePassword: row.mustChangePassword}, {passwordReset: '已重置（不记录密码内容）', mustChangePassword: true})
                }
            })
        },
        async remove(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const {version} = await parseInput(userDeleteSchema, input)
            return write(actor, meta, 'users.delete', raw, 'system.users.delete', async (tx, current) => {
                const row = await target(tx, actor, raw, current, version)
                await createAccountService(database, checkBlocklist, tx).softDeleteOrdinary(raw, version, String(actor))
                // 保留旧角色关联及操作者引用，历史身份稳定；删除释放用户名，新账号使用新 ID。
                return {value: null, id: raw, name: row.displayName, changes: auditChanges('user', row, null)}
            })
        },
    }
}
