// 协调角色业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {auditedWrite, type AuditedResult} from './operations/audited-write'
import {requirePermission as checkPermission} from './access/permissions'
import {auditChanges} from '../policies/audit-changes'
import {resolveListPageSize} from './parameter-values'
// 角色纵向业务：服务端权限上限、乐观锁、引用保护和事务内审计。
import {z} from 'zod'
import type {Database, DatabaseExecutor, DatabaseTransaction} from '../db/transaction'
import {roleRepository as repo} from '../repositories/roles'
import {permissionCatalog} from '../config/permissions'
import type {AuthMeta} from '../core/auth-context'
import {ApiError, conflictError} from '../core/errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {listQuerySchema} from '#shared/schemas/admin/pagination'
import {roleCreateSchema, roleUpdateSchema, roleDeleteSchema} from '#shared/schemas/admin/roles.ts'

export const roleListSchema = listQuerySchema.safeExtend({status: z.enum(['enabled', 'disabled']).optional()})
const dto = (row: NonNullable<Awaited<ReturnType<typeof repo.find>>>) => ({
    ...row,
    id: String(row.id),
    createdBy: row.createdBy === null ? null : String(row.createdBy),
    updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
})

export function createRoleService(database: Database) {
    const requirePermission = (actor: bigint, permission: string, executor: DatabaseExecutor = database) => checkPermission(executor, actor, permission)

    const write = <T>(actor: bigint, meta: AuthMeta, action: string, id: bigint | null, work: (tx: DatabaseTransaction) => Promise<AuditedResult<T>>) =>
        auditedWrite(database, {actor, meta, action, id, targetType: 'role'}, work)

    async function lockRole(tx: Parameters<Parameters<Database['transaction']>[0]>[0], id: bigint, version: number, actor: bigint, permission: string) {
        const current = await requirePermission(actor, permission, tx)
        const row = await repo.find(tx, id, true)
        if (!row) throw new ApiError('NOT_FOUND')
        if (row.version !== version) throw conflictError('STALE', 'version')
        const codes = await repo.permissionCodes(tx, id)
        if (!current.isRoot && codes.some(code => !current.permissions.includes(code))) throw new ApiError('FORBIDDEN')
        return {row, current}
    }

    return {
        async list(actor: bigint, input: unknown) {
            await requirePermission(actor, 'system.roles.read')
            const parsed = await parseInput(roleListSchema, input)
            const query = (input as Record<string, unknown>)?.pageSize === undefined ? await parseInput(roleListSchema, {
                ...(input as Record<string, unknown>),
                pageSize: String(await resolveListPageSize(database))
            }) : parsed
            const result = await repo.list(database, query)
            return {...result, items: result.items.map(row => ({...dto(row), userCount: row.userCount}))}
        },
        async detail(actor: bigint, raw: string) {
            await requirePermission(actor, 'system.roles.read')
            const id = BigInt(await parseInput(entityIdSchema, raw)), row = await repo.find(database, id)
            if (!row) throw new ApiError('NOT_FOUND')
            return {...dto(row), permissions: await repo.permissionCodes(database, id)}
        },
        async catalog(actor: bigint) {
            const current = await requirePermission(actor, 'system.roles.read')
            return permissionCatalog.filter(item => item.code !== 'account.permissions.read').map(item => ({
                ...item,
                grantable: item.available && (current.isRoot || current.permissions.includes(item.code))
            }))
        },
        async create(actor: bigint, input: unknown, meta: AuthMeta) {
            const data = await parseInput(roleCreateSchema, input)
            return write(actor, meta, 'roles.create', null, async tx => {
                await requirePermission(actor, 'system.roles.create', tx)
                const id = await repo.insert(tx, {...data, createdBy: actor, updatedBy: actor})
                return {value: {id: String(id)}, id, name: data.name, changes: auditChanges('role', null, data)}
            })
        },
        async update(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)), data = await parseInput(roleUpdateSchema, input)
            return write(actor, meta, 'roles.update', id, async tx => {
                const {row} = await lockRole(tx, id, data.version, actor, 'system.roles.update')
                if (!await repo.update(tx, id, data.version, actor, {
                    name: data.name,
                    enabled: data.enabled
                })) throw conflictError('STALE', 'version')
                return {
                    value: {version: data.version + 1},
                    id,
                    name: row.name,
                    changes: auditChanges('role', row, {...row, name: data.name, enabled: data.enabled}),
                    auditAction: data.enabled !== row.enabled && data.name === row.name ? (data.enabled ? 'roles.enable' : 'roles.disable') : undefined
                }
            })
        },
        async remove(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)),
                data = await parseInput(roleDeleteSchema, input)
            return write(actor, meta, 'roles.delete', id, async tx => {
                const {row} = await lockRole(tx, id, data.version, actor, 'system.roles.delete')
                if (await repo.referenced(tx, id)) throw conflictError('REFERENCED', 'references')
                await repo.remove(tx, id)
                return {value: null, id, name: row.name, changes: auditChanges('role', row, null)}
            })
        },
    }
}
