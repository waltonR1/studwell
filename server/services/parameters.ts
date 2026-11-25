// 协调系统参数业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {parameterRelations} from '#shared/utils/admin/parameter-relations.ts'
import {auditChanges} from '../policies/audit-changes'
import {auditService} from './audit'
import {createHash} from 'node:crypto'
import type {Database} from '../db/transaction'
import {parameterDefinitions, type ParameterDefinition} from '../config/parameters'
import {parameterRepository as repo} from '../repositories/parameters'
import {requirePermission} from './access/permissions'
import {ApiError, ConfigurationError, conflictError} from '../core/errors'
import {databaseConflictField, databaseConflictReason} from '../core/db-errors'
import {parseInput} from '../core/validation'
import {entityIdSchema} from '#shared/schemas/entity'
import {parameterUpdateSchema, parameterBatchSchema} from '#shared/schemas/admin/parameters'
import type {ParameterRecord} from '#shared/types/admin/parameters.ts'
import type {AuthMeta} from '../core/auth-context'
import {readParameterValues, requireParameter, resolveParameterRows} from './parameter-values'

type State = Awaited<ReturnType<typeof readParameterValues>>

function dto(state: State, definition: ParameterDefinition): ParameterRecord {
    const row = state.rows.find(item => item.key === definition.key)
    if (!row) throw new ConfigurationError('PARAMETER_SEED_REQUIRED')
    const {schema: _schema, ...metadata} = definition, invalidOverride = state.invalid.has(definition.key),
        value = requireParameter(state.values, definition.key)
    return {
        ...metadata,
        defaultValue: requireParameter(state.defaults, definition.key),
        value,
        invalidOverride,
        override: row.value === null || invalidOverride ? null : value,
        id: String(row.id),
        version: row.version,
        createdBy: row.createdBy === null ? null : String(row.createdBy),
        updatedBy: row.updatedBy === null ? null : String(row.updatedBy),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    }
}

export function createParameterService(database: Database) {


    async function save(actor: bigint, items: Array<{
        id: string;
        version: number;
        value: number | boolean | null
    }>, meta: AuthMeta) {
        try {
            return await database.transaction(async tx => {
                const rows = await repo.all(tx, true), state = resolveParameterRows(rows)
                await requirePermission(tx, actor, 'system.parameters.update')
                const targets = items.map(item => {
                    const row = rows.find(row => String(row.id) === item.id),
                        definition = parameterDefinitions.find(def => def.key === row?.key)
                    if (!row || !definition) throw new ApiError('NOT_FOUND')
                    return {item, row, definition}
                })
                if (targets.some(target => target.definition.security)) await requirePermission(tx, actor, 'system.parameters.security.update')
                for (const group of ['session', 'password']) {
                    if (!targets.some(target => target.definition.group === group)) continue
                    const invalidKeys = parameterDefinitions.filter(definition => definition.group === group && state.invalid.has(definition.key)).map(definition => definition.key)
                    if (invalidKeys.some(key => !targets.some(target => target.definition.key === key))) throw new ApiError('INVALID_INPUT', [{
                        path: 'value',
                        message: '请整组修正当前无效的安全策略，或恢复本组默认值。'
                    }])
                }
                const candidate = {...state.values}
                for (const {item, row, definition} of targets) {
                    if (!definition.editable) throw new ApiError('FORBIDDEN')
                    if (row.version !== item.version) throw conflictError('STALE', 'version')
                    candidate[definition.key] = item.value === null ? requireParameter(state.defaults, definition.key) : await parseInput(definition.schema, item.value)
                }
                const relation = parameterRelations(candidate)
                if (relation) throw new ApiError('INVALID_INPUT', [{path: 'value', message: relation}])
                for (const {item, row, definition} of targets) {
                    if (!await repo.update(tx, row.id, item.version, item.value === null ? null : JSON.stringify(item.value), actor)) throw conflictError('STALE', 'version')
                    await auditService.write(tx, {
                        ...meta,
                        actorId: actor,
                        action: item.value === null ? 'parameters.reset' : 'parameters.update',
                        targetType: 'parameter',
                        targetId: item.id,
                        targetName: definition.name,
                        changeContext: auditChanges('parameter', {value: state.values[definition.key], override: row.value === null ? null : state.invalid.has(definition.key) ? '无效覆盖值' : state.values[definition.key]}, {value: candidate[definition.key], override: item.value}),
                        result: 'success',
                        createdAt: new Date()
                    })
                }
                const updated = resolveParameterRows(await repo.all(tx))
                return targets.map(target => dto(updated, target.definition))
            }, {isolationLevel: 'read committed'})
        } catch (error) {
            await auditService.failure(database, {
                ...meta,
                actorId: actor,
                action: items.every(item => item.value === null) ? 'parameters.reset' : 'parameters.update',
                targetType: 'parameter',
                targetId: items.length === 1 ? items[0]!.id : null,
                result: 'failed',
                createdAt: new Date()
            }, error)
            const reason = databaseConflictReason(error)
            if (reason) throw conflictError(reason, databaseConflictField(reason))
            throw error
        }
    }

    return {
        async list(actor: bigint) {
            await requirePermission(database, actor, 'system.parameters.read');
            const state = await readParameterValues(database);
            return parameterDefinitions.map(definition => dto(state, definition))
        },
        async preferences(actor: bigint, version?: string) {
            await requirePermission(database, actor, 'account.permissions.read')
            const state = await readParameterValues(database),
                pageSize = Number(requireParameter(state.values, 'admin.list.defaultPageSize'))
            const current = createHash('sha256').update(JSON.stringify({
                key: 'admin.list.defaultPageSize',
                version: state.rows.find(row => row.key === 'admin.list.defaultPageSize')!.version,
                pageSize
            })).digest('hex')
            return current === version ? {changed: false as const, version: current} : {
                changed: true as const,
                version: current,
                pageSize
            }
        },
        async update(actor: bigint, raw: string, input: unknown, meta: AuthMeta) {
            const id = await parseInput(entityIdSchema, raw), data = await parseInput(parameterUpdateSchema, input);
            return (await save(actor, [{id, ...data}], meta))[0]!
        },
        async batch(actor: bigint, input: unknown, meta: AuthMeta) {
            return save(actor, (await parseInput(parameterBatchSchema, input)).items, meta)
        },
    }
}
