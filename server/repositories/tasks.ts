// 负责任务的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
import {and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, notExists, sql} from 'drizzle-orm'
import {adminTasks, adminTaskRuns, adminTaskCommands} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export type TaskRow = typeof adminTasks.$inferSelect
export type TaskRunRow = typeof adminTaskRuns.$inferSelect
export const taskRepository = {
    // 保留更早的计划；执行中新提交的内容会留下一次执行时间。
    async requestSearchRebuild(db: DatabaseExecutor) {
        await db.update(adminTasks).set({
            nextRunAt:sql`least(coalesce(${adminTasks.nextRunAt}, current_timestamp(3)), current_timestamp(3))`
        }).where(eq(adminTasks.code,'search_rebuild'))
    },
    async renewLease(db: DatabaseExecutor, taskId: bigint, runId: bigint, token: string, ownerId: string, now: Date, until: Date) {
        await db.update(adminTasks).set({leaseUntil: until, heartbeatAt: now, appliedVersion: sql`${adminTasks.version}`})
            .where(and(eq(adminTasks.id, taskId), eq(adminTasks.activeRunId, runId), eq(adminTasks.activeToken, token), eq(adminTasks.ownerId, ownerId)))
    },
    async acknowledgeFinishedCommands(db: DatabaseExecutor, statuses: readonly string[], now: Date) {
        const stale = await db.select({id: adminTaskCommands.id}).from(adminTaskCommands).innerJoin(adminTaskRuns, eq(adminTaskRuns.id, adminTaskCommands.runId))
            .where(and(isNull(adminTaskCommands.handledAt), inArray(adminTaskRuns.status, [...statuses]))).limit(100)
        if (stale.length) await db.update(adminTaskCommands).set({handledAt: now}).where(inArray(adminTaskCommands.id, stale.map(row => row.id)))
    },
    async pruneRuns(db: DatabaseExecutor, statuses: readonly string[], cutoff: Date, limit: number) {
        const pending = db.select({id: adminTaskCommands.id}).from(adminTaskCommands).where(and(eq(adminTaskCommands.runId, adminTaskRuns.id), isNull(adminTaskCommands.handledAt)))
        const rows = await db.select({id: adminTaskRuns.id}).from(adminTaskRuns)
            .where(and(inArray(adminTaskRuns.status, [...statuses]), lt(adminTaskRuns.finishedAt, cutoff), notExists(pending)))
            .orderBy(asc(adminTaskRuns.finishedAt), asc(adminTaskRuns.id)).limit(limit).for('update', {skipLocked: true})
        if (rows.length) {
            await db.delete(adminTaskCommands).where(inArray(adminTaskCommands.runId, rows.map(row => row.id)))
            await db.delete(adminTaskRuns).where(inArray(adminTaskRuns.id, rows.map(row => row.id)))
        }
        return rows.length
    },
    async updateConfiguration(db: DatabaseExecutor, id: bigint, version: number, changes: Partial<Omit<typeof adminTasks.$inferInsert, 'id' | 'version'>>) {
        const [result] = await db.update(adminTasks).set({...changes, version: sql`${adminTasks.version} + 1`})
            .where(and(eq(adminTasks.id, id), eq(adminTasks.version, version), lt(adminTasks.version, MAX_ENTITY_VERSION)))
        return result.affectedRows === 1
    },
    async updateTask(db: DatabaseExecutor, id: bigint, changes: Partial<Omit<typeof adminTasks.$inferInsert, 'id' | 'version'>>) {
        await db.update(adminTasks).set(changes).where(eq(adminTasks.id, id))
    },
    async updateRun(db: DatabaseExecutor, id: bigint, changes: Partial<Omit<typeof adminTaskRuns.$inferInsert, 'id'>>) {
        await db.update(adminTaskRuns).set(changes).where(eq(adminTaskRuns.id, id))
    },
    async insertRun(db: DatabaseExecutor, input: Omit<typeof adminTaskRuns.$inferInsert, 'id'>) {
        const row = await withEntityIds(db, 'admin_task_runs', input)
        await db.insert(adminTaskRuns).values(row)
        return row.id
    },
    async insertCommand(db: DatabaseExecutor, input: Omit<typeof adminTaskCommands.$inferInsert, 'id'>) {
        await db.insert(adminTaskCommands).values(await withEntityIds(db, 'admin_task_commands', input))
    },
    async acknowledgeCommands(db: DatabaseExecutor, runId: bigint, now: Date) {
        await db.update(adminTaskCommands).set({handledAt: now}).where(and(eq(adminTaskCommands.runId, runId), isNull(adminTaskCommands.handledAt)))
    },
    async commandsForRuns(db: DatabaseExecutor, runIds: bigint[]) {
        return runIds.length ? db.select().from(adminTaskCommands).where(and(inArray(adminTaskCommands.runId, runIds), isNull(adminTaskCommands.handledAt), inArray(adminTaskCommands.action, ['stop', 'force']))) : []
    },
    all: (db: DatabaseExecutor) => db.select().from(adminTasks).orderBy(asc(adminTasks.id)),
    async task(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(adminTasks).where(eq(adminTasks.id, id)).limit(1)
        return (await (lock ? query.for('update') : query))[0]
    },
    async byCode(db: DatabaseExecutor, code: string) {
        return (await db.select().from(adminTasks).where(eq(adminTasks.code, code)).limit(1))[0]
    },
    async run(db: DatabaseExecutor, id: bigint, lock = false) {
        const query = db.select().from(adminTaskRuns).where(eq(adminTaskRuns.id, id)).limit(1)
        return (await (lock ? query.for('update') : query))[0]
    },
    async latest(db: DatabaseExecutor, taskId: bigint) {
        return (await db.select().from(adminTaskRuns).where(eq(adminTaskRuns.taskId, taskId)).orderBy(desc(adminTaskRuns.createdAt), desc(adminTaskRuns.id)).limit(1))[0]
    },
    async runs(db: DatabaseExecutor, taskId: bigint, query: {
        status?: string;
        trigger?: string;
        start?: Date;
        end?: Date;
        page: number;
        pageSize: number
    }) {
        const where = and(eq(adminTaskRuns.taskId, taskId), query.status ? eq(adminTaskRuns.status, query.status) : undefined, query.trigger ? eq(adminTaskRuns.trigger, query.trigger) : undefined, query.start ? gte(adminTaskRuns.createdAt, query.start) : undefined, query.end ? lte(adminTaskRuns.createdAt, query.end) : undefined)
        const items = await db.select().from(adminTaskRuns).where(where).orderBy(desc(adminTaskRuns.createdAt), desc(adminTaskRuns.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize)
        const [total] = await db.select({count: count()}).from(adminTaskRuns).where(where)
        return {items, total: total!.count, page: query.page, pageSize: query.pageSize}
    },
    async pendingCommands(db: DatabaseExecutor, runId: bigint) {
        return db.select().from(adminTaskCommands).where(and(eq(adminTaskCommands.runId, runId), inArray(adminTaskCommands.action, ['stop', 'force']))).orderBy(desc(adminTaskCommands.createdAt), desc(adminTaskCommands.id)).limit(20)
    },
}
