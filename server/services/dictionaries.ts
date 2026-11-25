// 协调字典业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import type {LogChangeContext} from '#shared/types/admin/log-changes'
import {auditChanges} from '../policies/audit-changes'
import {auditService} from './audit'
import {createHash} from 'node:crypto'
import {z} from 'zod'
import type {Database, DatabaseExecutor, DatabaseTransaction} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {dictionaryRepository as repo} from '../repositories/dictionaries'
import {requirePermission} from './access/permissions'
import {resolveListPageSize} from './parameter-values'
import {ApiError, conflictError} from '../core/errors'
import {databaseConflictField, databaseConflictReason} from '../core/db-errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {listQuerySchema} from '#shared/schemas/admin/pagination'
import {
    dictionaryCreateSchema,
    dictionaryUpdateSchema,
    dictionaryItemCreateSchema,
    dictionaryItemUpdateSchema
} from '#shared/schemas/admin/dictionaries.ts'
import type {
    DictionaryDetail,
    DictionaryRecord,
    DictionaryItem,
    DictionaryOptionsResponse
} from '#shared/types/admin/dictionaries.ts'

const querySchema = listQuerySchema.safeExtend({status: z.enum(['enabled', 'disabled']).optional()})
export const MAX_DICTIONARY_ITEMS = 500
type DictionaryRow = NonNullable<Awaited<ReturnType<typeof repo.find>>>
type ItemRow = NonNullable<Awaited<ReturnType<typeof repo.findItem>>>

function metadata(row: DictionaryRow | ItemRow) {
    return {
        createdBy: row.createdBy === null ? null : String(row.createdBy),
        updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    }
}

function dictionaryDto(row: DictionaryRow, counts = {optionCount: 0, enabledOptionCount: 0}): DictionaryRecord {
    return {
        ...metadata(row),
        id: String(row.id),
        code: row.code,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        version: row.version, ...counts
    }
}

function itemDto(row: ItemRow): DictionaryItem {
    return {
        ...metadata(row),
        id: String(row.id),
        dictionaryId: String(row.dictionaryId),
        code: row.code,
        name: row.name,
        sortOrder: row.sortOrder,
        enabled: row.enabled
    }
}

async function detail(db: DatabaseExecutor, id: bigint): Promise<DictionaryDetail> {
    const snapshot = await repo.snapshot(db, id)
    if (!snapshot) throw new ApiError('NOT_FOUND')
    const enabledOptionCount = snapshot.items.filter(item => item.enabled).length
    return {
        ...dictionaryDto(snapshot.dictionary, {optionCount: snapshot.items.length, enabledOptionCount}),
        items: snapshot.items.map(itemDto)
    }
}

// 供未来业务在自身事务中校验；不将核心状态码迁入字典，不绕过业务模块授权。
export async function resolveDictionaryItem(db: DatabaseExecutor, dictionaryId: string, itemId: string) {
    const parent = BigInt(await parseInput(entityIdSchema, dictionaryId)),
        id = BigInt(await parseInput(entityIdSchema, itemId))
    const snapshot = await repo.snapshot(db, parent), item = snapshot?.items.find(row => row.id === id)
    if (!snapshot || !item) throw new ApiError('NOT_FOUND')
    return {...itemDto(item), dictionaryEnabled: snapshot.dictionary.enabled}
}

// 新增业务引用必须在自身事务中调用：按父后子加锁并使用当前读，避免旧快照接纳刚禁用的选项。
export async function requireActiveDictionaryItem(tx: DatabaseTransaction, dictionaryId: string, itemId: string) {
    const parentId = BigInt(await parseInput(entityIdSchema, dictionaryId)),
        id = BigInt(await parseInput(entityIdSchema, itemId))
    const parent = await repo.find(tx, parentId, true),
        item = parent ? await repo.findItem(tx, id, parentId, true) : undefined
    if (!parent || !item) throw new ApiError('NOT_FOUND')
    if (!parent.enabled || !item.enabled) throw new ApiError('INVALID_INPUT')
    return {...itemDto(item), dictionaryEnabled: parent.enabled}
}

export function createDictionaryService(database: Database) {


    async function lock(tx: DatabaseTransaction, actor: bigint, id: bigint, version: number, permission: string) {
        const row = await repo.find(tx, id, true)
        await requirePermission(tx, actor, permission)
        if (!row) throw new ApiError('NOT_FOUND')
        if (row.version !== version) throw conflictError('STALE', 'version')
        return row
    }

    async function write<T>(actor: bigint, meta: AuthMeta, action: string, targetType: string, targetId: string | null, work: (tx: DatabaseTransaction) => Promise<{
        value: T;
        id: string;
        name: string;
        changes: LogChangeContext;
        auditAction?: string
    }>) {
        try {
            return await database.transaction(async tx => {
                const result = await work(tx)
                await auditService.write(tx, {
                    ...meta,
                    actorId: actor,
                    action: result.auditAction ?? action,
                    targetType,
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
                targetType,
                targetId,
                result: 'failed',
                createdAt: new Date()
            }, error)
            const reason = databaseConflictReason(error)
            if (reason) throw conflictError(reason, databaseConflictField(reason))
            throw error
        }
    }

    return {
        async list(actor: bigint, input: unknown) {
            await requirePermission(database, actor, 'system.dictionaries.read')
            const parsed = await parseInput(querySchema, input)
            const query = (input as Record<string, unknown>).pageSize === undefined ? await parseInput(querySchema, {
                ...(input as Record<string, unknown>),
                pageSize: String(await resolveListPageSize(database))
            }) : parsed
            const result = await repo.list(database, query)
            return {
                ...result,
                items: result.items.map(row => dictionaryDto(row.dictionary, {
                    optionCount: Number(row.optionCount),
                    enabledOptionCount: Number(row.enabledOptionCount)
                }))
            }
        },
        async detail(actor: bigint, raw: string) {
            await requirePermission(database, actor, 'system.dictionaries.read')
            return detail(database, BigInt(await parseInput(entityIdSchema, raw)))
        },
        async create(actor: bigint, input: unknown, meta: AuthMeta) {
            const data = await parseInput(dictionaryCreateSchema, input)
            return write(actor, meta, 'dictionaries.create', 'dictionary', null, async tx => {
                await requirePermission(tx, actor, 'system.dictionaries.create')
                const id = await repo.insert(tx, {...data, createdBy: actor, updatedBy: actor})
                return {value: await detail(tx, id), id: String(id), name: data.name, changes: auditChanges('dictionary', null, data)}
            })
        },
        async update(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)),
                data = await parseInput(dictionaryUpdateSchema, input)
            return write(actor, meta, 'dictionaries.update', 'dictionary', raw, async tx => {
                const previous = await lock(tx, actor, id, data.version, 'system.dictionaries.update')
                const {version, ...fields} = data
                if (!await repo.update(tx, id, version, actor, fields)) throw conflictError('STALE', 'version')
                return {
                    value: await detail(tx, id),
                    id: String(id),
                    name: data.name,
                    changes: auditChanges('dictionary', previous, {...previous, ...fields}),
                    auditAction: data.enabled !== previous.enabled && data.name === previous.name && data.description === previous.description ? (data.enabled ? 'dictionaries.enable' : 'dictionaries.disable') : undefined
                }
            })
        },
        async createItem(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const dictionaryId = BigInt(await parseInput(entityIdSchema, raw)),
                data = await parseInput(dictionaryItemCreateSchema, input)
            return write(actor, meta, 'dictionaries.items.create', 'dictionary_item', null, async tx => {
                await lock(tx, actor, dictionaryId, data.version, 'system.dictionaries.items.create')
                if (await repo.itemCount(tx, dictionaryId) >= MAX_DICTIONARY_ITEMS) throw new ApiError('INVALID_INPUT')
                const {version, ...fields} = data
                const id = await repo.insertItem(tx, {...fields, dictionaryId, createdBy: actor, updatedBy: actor})
                if (!await repo.update(tx, dictionaryId, version, actor, {})) throw conflictError('STALE', 'version')
                return {value: await detail(tx, dictionaryId), id: String(id), name: data.name, changes: auditChanges('dictionary_item', null, {...fields, dictionaryId})}
            })
        },
        async updateItem(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, raw)),
                data = await parseInput(dictionaryItemUpdateSchema, input), dictionaryId = BigInt(data.dictionaryId)
            return write(actor, meta, 'dictionaries.items.update', 'dictionary_item', raw, async tx => {
                await lock(tx, actor, dictionaryId, data.version, 'system.dictionaries.items.update')
                const previous = await repo.findItem(tx, id, dictionaryId)
                if (!previous) throw new ApiError('NOT_FOUND')
                const version = data.version,
                    fields = {name: data.name, enabled: data.enabled, sortOrder: data.sortOrder}
                await repo.updateItem(tx, id, actor, fields)
                if (!await repo.update(tx, dictionaryId, version, actor, {})) throw conflictError('STALE', 'version')
                return {value: await detail(tx, dictionaryId), id: String(id), name: data.name, changes: auditChanges('dictionary_item', previous!, {...previous, ...fields})}
            })
        },
        async options(actor: bigint, raw: string, version?: string): Promise<DictionaryOptionsResponse> {
            await requirePermission(database, actor, 'system.dictionaries.read')
            return readDictionaryOptions(database, raw, version)
        },
    }
}

// 仅供服务端业务在完成自身模块鉴权后调用；不直接作为公开 Handler。
export async function readDictionaryOptions(db: DatabaseExecutor, raw: string, version?: string): Promise<DictionaryOptionsResponse> {
    const snapshot = await repo.snapshot(db, BigInt(await parseInput(entityIdSchema, raw)))
    if (!snapshot) throw new ApiError('NOT_FOUND')
    const row = snapshot.dictionary
    const items = row.enabled ? snapshot.items.filter(item => item.enabled).map(item => ({
        id: String(item.id),
        code: item.code,
        name: item.name
    })) : []
    const current = createHash('sha256').update(JSON.stringify({
        id: String(row.id),
        code: row.code,
        name: row.name,
        enabled: row.enabled,
        version: row.version,
        items
    })).digest('hex')
    return current === version ? {changed: false, version: current} : {
        changed: true,
        version: current,
        dictionary: {id: String(row.id), code: row.code, name: row.name, enabled: row.enabled},
        items
    }
}
