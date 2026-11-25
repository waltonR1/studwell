// 协调单次任务执行与对应业务服务，不管理 Worker 进程。
import {readPublishedSiteContext} from '../site-languages'
import {lockSiteConfig} from '../../repositories/website-site-config'
import {LEASE_MS} from '../../config/task-execution'
import type {Database} from '../../db/transaction'
import {taskRepository as repo} from '../../repositories/tasks'
import {cleanupLogs} from '../cleanup/log-cleanup'
import {cleanupAuthState} from '../cleanup/auth-cleanup'
import {TaskCancelled, type MaintenanceControl} from '../cleanup/control'
import {taskRetentionSchema} from '#shared/schemas/admin/tasks'
import {taskCodes} from '#shared/config/admin/tasks'
import {cleanupTaskRuns} from '../cleanup/run-cleanup'
import {finishTask, lockExecution} from './state'
import {readSearchSnapshots} from '../published-search'
import {searchStoragePath} from '../../infrastructure/search-storage'
import {writeSearchIndexes} from '../search-indexes'
import {reportDiagnostic} from '../../infrastructure/diagnostics'

export async function executeTask(db: Database, id: bigint, token: string, stopping: () => boolean) {
    const run = await repo.run(db, id)
    if (!run || run.token !== token) return
    const task = await repo.task(db, run.taskId)
    if (!task || !(taskCodes as readonly string[]).includes(task.code)) throw new Error('TASK_NOT_REGISTERED')
    const control: MaintenanceControl = {
        requestId: run.requestId,
        async beforeBatch(tx) {
            if (stopping()) throw new TaskCancelled('STOPPED')
            await lockExecution(tx, id, token)
            if ((await repo.pendingCommands(tx, id)).some(c => !c.handledAt && c.token === token)) throw new TaskCancelled('STOPPED')
            await repo.updateTask(tx, run.taskId, {leaseUntil: new Date(Date.now() + LEASE_MS)})
        },
        async committed(tx, info) {
            const current = (await repo.run(tx, id, true))!
            if (current.token !== token || current.status !== 'running') throw new TaskCancelled('LEASE_LOST')
            const counts = [...current.counts], previous = counts.find(row => row.kind === info.kind)
            if (previous) Object.assign(previous, {
                deletedCount: previous.deletedCount + info.deletedCount,
                batches: previous.batches + 1,
                limitReached: info.limitReached,
                cutoff: info.cutoff,
                retentionDays: info.retentionDays
            })
            else counts.push({...info, batches: 1})
            await repo.updateRun(tx, id, {counts})
        },
    }
    try {
        if (task.code === 'log_cleanup') {
            await cleanupLogs(db, () => new Date(), {
                control,
                policy: {enabled: true, days: taskRetentionSchema.parse(run.snapshot.retention)}
            })
        } else if (task.code === 'auth_cleanup') await cleanupAuthState(db, () => new Date(), {control})
        else if (task.code === 'search_rebuild') {
            const snapshots = await readSearchSnapshots(db)
            await writeSearchIndexes(searchStoragePath(), snapshots, activate => db.transaction(async tx => {
                const config=await lockSiteConfig(tx)
                if((config.publishedReleaseId===null?null:String(config.publishedReleaseId))!==(snapshots[0]?.settings.configReleaseId??null))throw new Error('SEARCH_CONFIGURATION_CHANGED')
                const context=await readPublishedSiteContext(tx,config)
                if(context.languageReleaseId!==(snapshots[0]?.settings.languageReleaseId??null))throw new Error('SEARCH_CONFIGURATION_CHANGED')
                await control.beforeBatch(tx)
                await activate()
            }, {isolationLevel: 'read committed'}))
        } else await cleanupTaskRuns(db, control)
        await finishTask(db, id, token, stopping() ? 'stopped' : 'success', stopping() ? 'STOPPED' : null, new Date(), false, true)
    } catch (cause) {
        if (cause instanceof TaskCancelled) await finishTask(db, id, token, cause.reason === 'STOPPED' ? 'stopped' : 'interrupted', cause.reason, new Date(), false, true)
        else {
            reportDiagnostic('task_execution', run.requestId, cause)
            await finishTask(db, id, token, 'failed', 'EXECUTION_FAILED', new Date(), false, true)
        }
    }
}
