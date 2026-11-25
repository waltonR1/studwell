// 协调任务业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {TASK_SCHEDULER_OFFLINE_MS} from '../config/task-execution'
import {taskReasons, taskDefinitions} from '../config/tasks'
import type {Database, DatabaseExecutor, DatabaseTransaction} from '../db/transaction'
import {taskRepository as repo, type TaskRow, type TaskRunRow} from '../repositories/tasks'
import {userRepository} from '../repositories/users'
import {getPermissionSnapshot} from './access/permissions'
import type {LogChangeContext} from '#shared/types/admin/log-changes'
import {auditChanges} from '../policies/audit-changes'
import {auditService} from './audit'
import type {AuthMeta} from '../core/auth-context'
import {ApiError, conflictError} from '../core/errors'
import {databaseConflictReason} from '../core/db-errors'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseInput} from '../core/validation'
import {resolveListPageSize} from './parameter-values'
import {
    taskRunQuerySchema,
    taskControlSchema,
    taskPreviewSchema,
    taskRetentionSchema,
    taskRunSchema,
    taskScheduleSchema,
    taskStatusSchema,
    taskUpdateSchema
} from '#shared/schemas/admin/tasks'
import {type TaskPreviewResponse, type TaskCode, type TaskRecord, type TaskRunRecord, type RunStatus, type RunTrigger} from '#shared/types/admin/tasks'
import {taskCodes, runStatusNames, runTriggerNames} from '#shared/config/admin/tasks'
import {nextTaskTimes} from '../policies/task-schedule'
import {taskScheduleText} from '#shared/utils/admin/task-schedule.ts'
import {enqueueTask} from './tasks/state'


export function createTaskService(database: Database, options: { executionAllowed: boolean; clock?: () => Date }) {
    const now = options.clock ?? (() => new Date())

    async function allowed(db: DatabaseExecutor, actor: bigint, permission: string) {
        const snapshot = await getPermissionSnapshot(db, actor)
        if (!snapshot.permissions.includes(permission)) throw new ApiError('FORBIDDEN')
    }

    async function task(db: DatabaseExecutor, raw: string, lock = false) {
        const row = await repo.task(db, BigInt(await parseInput(entityIdSchema, raw)), lock)
        if (!row || !(taskCodes as readonly string[]).includes(row.code)) throw new ApiError('NOT_FOUND')
        return row
    }

    async function runDto(row: TaskRunRow, code: TaskCode, commands?: Awaited<ReturnType<typeof repo.commandsForRuns>>): Promise<TaskRunRecord> {
        const pending = (commands ?? await repo.pendingCommands(database, row.id)).filter(c => c.runId === row.id).filter(c => !c.handledAt && c.token === row.token)
        return {
            id: String(row.id),
            taskId: String(row.taskId),
            taskCode: code,
            groupId: row.groupId,
            requestId: row.requestId,
            trigger: Object.hasOwn(runTriggerNames, row.trigger) ? row.trigger as RunTrigger : 'scheduled',
            status: Object.hasOwn(runStatusNames, row.status) ? row.status as RunStatus : 'interrupted',
            createdAt: row.createdAt.toISOString(),
            startedAt: row.startedAt?.toISOString() ?? null,
            finishedAt: row.finishedAt?.toISOString() ?? null,
            durationMs: row.startedAt && row.finishedAt ? Math.max(0, row.finishedAt.getTime() - row.startedAt.getTime()) : null,
            counts: row.counts.map(c => ({
                kind: c.kind,
                deletedCount: c.deletedCount,
                batches: c.batches,
                limitReached: c.limitReached,
                cutoff: c.cutoff,
                retentionDays: c.retentionDays
            })),
            reason: row.reason ? taskReasons[row.reason] ?? '执行异常，请通过执行编号排查' : null,
            retryAt: row.retryAt?.toISOString() ?? null,
            attempt: row.attempt,
            continuation: row.continuation,
            snapshot: {
                schedule: taskScheduleSchema.parse(row.snapshot.schedule),
                retention: row.snapshot.retention ? taskRetentionSchema.parse(row.snapshot.retention) : null
            },
            pendingControl: pending.some(c => c.action === 'force') ? 'force' : pending.some(c => c.action === 'stop') ? 'stop' : null,
        }
    }

    async function dto(row: TaskRow): Promise<TaskRecord> {
        const code = row.code as TaskCode, definition = taskDefinitions[code],
            schedule = taskScheduleSchema.parse(row.schedule)
        const active = row.activeRunId ? await repo.run(database, row.activeRunId) : undefined,
            latest = await repo.latest(database, row.id)
        const online = options.executionAllowed && !!row.heartbeatAt && now().getTime() - row.heartbeatAt.getTime() < TASK_SCHEDULER_OFFLINE_MS
        return {
            id: String(row.id),
            code,
            name: definition.name,
            description: definition.description,
            enabled: row.enabled,
            version: row.version,
            appliedVersion: row.appliedVersion,
            schedule,
            retention: code === 'log_cleanup' ? taskRetentionSchema.parse(row.retention) : null,
            scheduleText: taskScheduleText(schedule),
            nextTimes: nextTaskTimes(code, schedule, now()).map(d => d.toISOString()),
            nextRunAt: online && row.enabled ? row.nextRunAt?.toISOString() ?? null : null,
            online,
            executionAllowed: options.executionAllowed,
            activeRun: active ? await runDto(active, code) : null,
            lastRun: latest ? await runDto(latest, code) : null,
        }
    }

    async function write<T>(actor: bigint, permission: string, action: string, targetId: string | null, meta: AuthMeta, work: (tx: DatabaseTransaction, audit: {changes?: LogChangeContext; name?: string}) => Promise<T>) {
        try {
            return await database.transaction(async tx => {
                await userRepository.roles(tx, true)
                await allowed(tx, actor, permission)
                const audit: {changes?: LogChangeContext; name?: string} = {}
                const result = await work(tx, audit)
                await auditService.write(tx, {
                    ...meta,
                    actorId: actor,
                    action,
                    targetType: 'scheduled_task',
                    targetName: audit.name,
                    changeContext: audit.changes,
                    targetId,
                    result: 'success',
                    createdAt: now()
                })
                return result
            }, {isolationLevel: 'read committed'})
        } catch (cause) {
            await auditService.failure(database, {
                ...meta,
                actorId: actor,
                action,
                targetType: 'scheduled_task',
                targetId,
                result: 'failed',
                createdAt: now()
            }, cause)
            const reason = databaseConflictReason(cause)
            if (reason) throw conflictError(reason)
            throw cause
        }
    }

    return {
        async list(actor: bigint) {
            await allowed(database, actor, 'system.tasks.read');
            return Promise.all((await repo.all(database)).filter(r => (taskCodes as readonly string[]).includes(r.code)).map(dto))
        },
        async preview(actor: bigint, input: unknown): Promise<TaskPreviewResponse> {
            await allowed(database, actor, 'system.tasks.read');
            const data = await parseInput(taskPreviewSchema, input)
            return {
                times: nextTaskTimes(data.code, data.schedule, now()).map(d => d.toISOString()),
                text: taskScheduleText(data.schedule)
            }
        },
        async update(actor: bigint, id: string, input: unknown, meta: AuthMeta) {
            const data = await parseInput(taskUpdateSchema, input)
            await write(actor, 'system.tasks.update', 'tasks.update', id, meta, async (tx, audit) => {
                const row = await task(tx, id, true)
                if (row.version !== data.version) throw conflictError('STALE', 'version')
                if ((row.code === 'log_cleanup') !== (data.retention !== null)) throw new ApiError('INVALID_INPUT')
                audit.name = taskDefinitions[row.code as TaskCode].name
                const retention = (value: typeof row.retention) => ({loginDays: value?.login ?? null, auditDays: value?.audit ?? null, securityDays: value?.security ?? null})
                audit.changes = auditChanges('scheduled_task', {schedule: taskScheduleText(row.schedule), ...retention(row.retention)}, {schedule: taskScheduleText(data.schedule), ...retention(data.retention)})
                const next = nextTaskTimes(row.code as TaskCode, data.schedule, now(), 1)[0]!
                if (!await repo.updateConfiguration(tx, row.id, row.version, {
                    schedule: data.schedule,
                    retention: data.retention,
                    updatedAt: now(),
                    nextRunAt: row.activeRunId ? null : row.enabled ? next : null,
                    pendingTrigger: 'scheduled',
                    pendingGroupId: null,
                    pendingRetry: 0,
                    pendingContinuation: 0
                })) throw conflictError('STALE', 'version')
            })
            return {saved: true, synchronization: 'pending'}
        },
        async status(actor: bigint, id: string, input: unknown, meta: AuthMeta) {
            const data = await parseInput(taskStatusSchema, input)
            await write(actor, 'system.tasks.change_status', data.enabled ? 'tasks.enable' : 'tasks.disable', id, meta, async (tx, audit) => {
                const row = await task(tx, id, true)
                if (row.version !== data.version) throw conflictError('STALE', 'version')
                audit.name = taskDefinitions[row.code as TaskCode].name
                audit.changes = auditChanges('scheduled_task', {enabled: row.enabled}, {enabled: data.enabled})
                if (!await repo.updateConfiguration(tx, row.id, row.version, {
                    enabled: data.enabled,
                    updatedAt: now(),
                    nextRunAt: null,
                    pendingTrigger: 'startup',
                    pendingGroupId: null,
                    pendingRetry: 0,
                    pendingContinuation: 0
                })) throw conflictError('STALE', 'version')
            })
            return {saved: true, synchronization: 'pending'}
        },
        async run(actor: bigint, id: string, input: unknown, meta: AuthMeta) {
            const data = await parseInput(taskRunSchema, input)
            return write(actor, 'system.tasks.run', 'tasks.run', id, meta, async tx => {
                if (!options.executionAllowed) throw new ApiError('TASK_EXECUTION_DISABLED')
                const row = await task(tx, id, true)
                if (row.version !== data.version) throw conflictError('STALE', 'version')
                if (row.activeRunId !== null) throw new ApiError('TASK_BUSY')
                if (!row.heartbeatAt || now().getTime() - row.heartbeatAt.getTime() >= TASK_SCHEDULER_OFFLINE_MS) throw new ApiError('TASK_SCHEDULER_OFFLINE')
                const run = await enqueueTask(tx, row, 'manual', actor, now())
                return {accepted: true, runId: String(run.id)}
            })
        },
        async control(actor: bigint, rawRunId: string, input: unknown, meta: AuthMeta) {
            const id = BigInt(await parseInput(entityIdSchema, rawRunId)),
                data = await parseInput(taskControlSchema, input)
            return write(actor, data.action === 'force' ? 'system.tasks.force_stop' : 'system.tasks.stop', data.action === 'force' ? 'tasks.force_stop' : 'tasks.stop', rawRunId, meta, async tx => {
                if (!options.executionAllowed) throw new ApiError('TASK_EXECUTION_DISABLED')
                // 不锁执行/任务进度行：长SQL也不能阻止控制信箱和审计提交。
                const row = await repo.run(tx, id)
                if (!row) throw new ApiError('NOT_FOUND')
                if (!['queued', 'running'].includes(row.status)) throw new ApiError('TASK_FINISHED')
                const existing = (await repo.pendingCommands(tx, id)).find(c => !c.handledAt && c.action === data.action)
                if (!existing) await repo.insertCommand(tx, {
                    runId: id,
                    token: row.token,
                    action: data.action,
                    createdAt: now()
                })
                return {accepted: true, runId: String(id), action: data.action}
            })
        },
        async records(actor: bigint, rawTaskId: string, input: unknown) {
            await allowed(database, actor, 'system.tasks.read')
            const row = await task(database, rawTaskId), parsed = await parseInput(taskRunQuerySchema, input)
            const pageSize = (input as Record<string, unknown>)?.pageSize === undefined ? await resolveListPageSize(database) : parsed.pageSize
            const page = await repo.runs(database, row.id, {
                ...parsed,
                pageSize,
                start: parsed.startDate ? new Date(`${parsed.startDate}T00:00:00+08:00`) : undefined,
                end: parsed.endDate ? new Date(new Date(`${parsed.endDate}T00:00:00+08:00`).getTime() + 86400_000 - 1) : undefined
            })
            const commands = await repo.commandsForRuns(database, page.items.map(run => run.id))
            return {...page, items: await Promise.all(page.items.map(r => runDto(r, row.code as TaskCode, commands)))}
        },
        async record(actor: bigint, rawRunId: string) {
            await allowed(database, actor, 'system.tasks.read')
            const row = await repo.run(database, BigInt(await parseInput(entityIdSchema, rawRunId)))
            if (!row) throw new ApiError('NOT_FOUND')
            const parent = await task(database, String(row.taskId))
            return runDto(row, parent.code as TaskCode)
        },
    }
}
