// 读取并解释系统参数，向业务模块提供已校验的生效策略。
import {parameterRelations} from '#shared/utils/admin/parameter-relations.ts'
// 内部消费者只读取代码登记的参数；不依赖后台管理权限，不缓存数据库有效值。
import type {DatabaseExecutor} from '../db/transaction'
import {parameterRepository} from '../repositories/parameters'
import {parameterDefinitions} from '../config/parameters'
import type {ParameterValue} from '#shared/types/admin/parameters.ts'
import {ConfigurationError} from '../core/errors'
import {reportParameterFallback} from '../infrastructure/diagnostics'
import {taskRepository} from '../repositories/tasks'
import {taskRetentionSchema} from '#shared/schemas/admin/tasks'

function parseStoredValue(value: string, definition: typeof parameterDefinitions[number]) {
    try {
        const parsed = definition.schema.safeParse(JSON.parse(value))
        return parsed.success ? parsed.data : undefined
    } catch {
        return undefined
    }
}

export function resolveParameterRows(rows: Awaited<ReturnType<typeof parameterRepository.all>>) {
    const values: Record<string, ParameterValue> = {}, defaults: Record<string, ParameterValue> = {}, invalid = new Set<string>()
    function invalidOverride(key: string) {
        if (!invalid.has(key)) reportParameterFallback(key)
        invalid.add(key)
    }
    for (const definition of parameterDefinitions) {
        const row = rows.find(item => item.key === definition.key)
        if (!row) continue
        const defaultValue = parseStoredValue(row.defaultValue, definition)
        if (defaultValue === undefined) continue
        defaults[definition.key] = defaultValue
        const override = row.value === null ? undefined : parseStoredValue(row.value, definition)
        values[definition.key] = override ?? defaultValue
        if (row.value !== null && override === undefined) invalidOverride(definition.key)
    }
    for (const group of ['session', 'password'] as const) {
        const keys = parameterDefinitions.filter(item => item.group === group).map(item => item.key)
        if (keys.some(key => defaults[key] === undefined) || parameterRelations(defaults, group)) {
            for (const key of keys) {
                delete values[key]
                delete defaults[key]
            }
        } else if (parameterRelations(values, group)) {
            for (const key of keys) {
                values[key] = defaults[key]!
                invalidOverride(key)
            }
        }
    }
    return {values, defaults, invalid, rows}
}

export function requireParameter(values: Record<string, ParameterValue>, key: string) {
    const value = values[key]
    if (value === undefined) throw new ConfigurationError('PARAMETER_SEED_REQUIRED')
    return value
}

export async function readParameterValues(db: DatabaseExecutor) {
    return resolveParameterRows(await parameterRepository.all(db))
}

export async function resolveListPageSize(db: DatabaseExecutor) {
    return Number(requireParameter((await readParameterValues(db)).values, 'admin.list.defaultPageSize'))
}

export async function resolveLogExportLimit(db: DatabaseExecutor) {
    return Number(requireParameter((await readParameterValues(db)).values, 'admin.logs.exportLimit'))
}

export async function resolveLogRetention(db: DatabaseExecutor) {
    const task = await taskRepository.byCode(db, 'log_cleanup')
    if (!task) throw new Error('TASK_CONFIGURATION_MISSING')
    return {enabled: task.enabled, days: taskRetentionSchema.parse(task.retention)}
}

export async function resolvePasswordPolicy(db: DatabaseExecutor) {
    const {values} = await readParameterValues(db)
    return {
        minLength: Number(requireParameter(values, 'security.password.minLength')),
        maxLength: Number(requireParameter(values, 'security.password.maxLength')),
        blocklistEnabled: Boolean(requireParameter(values, 'security.password.blocklistEnabled'))
    }
}

export async function resolveSessionPolicy(db: DatabaseExecutor) {
    const {values} = await readParameterValues(db)
    return {
        anonymousMs: Number(requireParameter(values, 'security.session.anonymousSeconds')) * 1000,
        idleMs: Number(requireParameter(values, 'security.session.idleSeconds')) * 1000,
        absoluteMs: Number(requireParameter(values, 'security.session.absoluteSeconds')) * 1000
    }
}

export async function resolveRatePolicy(db: DatabaseExecutor, scope: string) {
    const state = await readParameterValues(db), prefix = 'security.rate.' + scope
    const count = Number(requireParameter(state.values, prefix + '.count')),
        windowMs = Number(requireParameter(state.values, prefix + '.windowSeconds')) * 1000
    const revision = state.rows.filter(row => row.key === prefix + '.count' || row.key === prefix + '.windowSeconds').map(row => row.version).join('.')
    return {count, windowMs, revision}
}
