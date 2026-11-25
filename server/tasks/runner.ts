// 常驻任务运行入口，协调轮询、Worker 生命周期及退出，不实现具体业务任务。
import {LEASE_MS, TASK_POLL_MS, TASK_SHUTDOWN_GRACE_MS, TASK_DIAGNOSTIC_INTERVAL_MS} from '../config/task-execution'
import {terminalRunStatuses} from '../config/tasks'
// 常驻服务只负责调度和控制；实际删除在隔离进程中执行。
import {fork, type ChildProcess} from 'node:child_process'
import {randomUUID} from 'node:crypto'
import {dirname, resolve} from 'node:path'
import type {Database} from '../db/transaction'
import {taskRepository as repo, type TaskRunRow} from '../repositories/tasks'
import {taskCodes} from '#shared/config/admin/tasks'
import {claimQueuedTask, finishTask} from '../services/tasks/state'
import {scheduleDueTask} from '../services/tasks/scheduling'
import {reportDiagnostic, forwardTaskDiagnostic, createDiagnosticLimiter, workerStartupError} from '../infrastructure/diagnostics'

interface ActiveWorker {
    child: ChildProcess;
    run: TaskRunRow;
    forceSent: boolean;
    heartbeat?: Promise<void>;
    done: Promise<void>
}

export function startTaskRunner(getDatabase: () => Database, databaseUrl: () => string, workerPath = resolve(dirname(process.argv[1] ?? ''), 'task-worker.mjs')) {
    const ownerId = randomUUID(), workers = new Map<string, ActiveWorker>(), recovering = new Set<string>()
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, ticking: Promise<void> | undefined
    const allowDiagnostic = createDiagnosticLimiter(TASK_DIAGNOSTIC_INTERVAL_MS)

    function report(cause: unknown, context?: {requestId?: string; runId: string; exitCode?: number | null; signal?: string | null}) {
        const allowance = allowDiagnostic(cause, context?.runId)
        if (allowance) reportDiagnostic('task_scheduler', context?.requestId, cause, {...context, ...allowance})
    }

    async function launch(db: Database, run: TaskRunRow) {
        const commands = await repo.pendingCommands(db, run.id)
        if (commands.some(c => !c.handledAt && c.token === run.token)) {
            await finishTask(db, run.id, run.token, 'stopped', 'STOPPED');
            return
        }
        let child: ChildProcess
        try {
            child = fork(workerPath, [], {
                execArgv: [],
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                env: {
                    ...process.env,
                    STUDWELL_TASK_RUN_ID: String(run.id),
                    STUDWELL_TASK_REQUEST_ID: run.requestId,
                    STUDWELL_TASK_TOKEN: run.token,
                    STUDWELL_TASK_DATABASE_URL: databaseUrl()
                }
            })
        } catch (cause) {
            reportDiagnostic('task_scheduler', run.requestId, cause, {runId: String(run.id)})
            await finishTask(db, run.id, run.token, 'failed', 'WORKER_START');
            return
        }
        const worker: ActiveWorker = {child, run, forceSent: false, done: Promise.resolve()}
        // 原始输出不直接转发；业务事件白名单投影，原生启动故障只提取类型和错误码。
        let startupReported = false
        for (const stream of [child.stdout, child.stderr]) {
            let buffer = ''
            function nativeError(line: string) {
                const cause = stream === child.stderr && !startupReported ? workerStartupError(line.trim()) : undefined
                if (cause) { startupReported = true; reportDiagnostic('task_scheduler', run.requestId, cause, {runId: String(run.id)}) }
            }
            stream?.on('end', () => { if (buffer.trim()) nativeError(buffer) })
            stream?.on('data', chunk => {
                buffer = (buffer + String(chunk)).slice(-131072)
                let newline: number
                while ((newline = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.slice(0, newline);
                    buffer = buffer.slice(newline + 1)
                    try {
                        const event = JSON.parse(line) as Record<string, unknown>
                        if (event.event === 'admin_maintenance' && event.runId === String(run.id) && event.requestId === run.requestId) console.log(JSON.stringify({
                            timestamp: new Date().toISOString(),
                            level: 'info',
                            event: 'admin_maintenance',
                            job: typeof event.job === 'string' && (taskCodes as readonly string[]).includes(event.job) ? event.job : 'unknown',
                            runId: String(run.id),
                            requestId: run.requestId,
                            reason: typeof event.reason === 'string' && /^[A-Z0-9_]{1,64}$/.test(event.reason) ? event.reason : null,
                            status: typeof event.status === 'string' && [...terminalRunStatuses].includes(event.status as typeof terminalRunStatuses[number]) ? event.status : 'interrupted',
                            deletedCount: Number.isSafeInteger(event.deletedCount) ? event.deletedCount : 0,
                            attempt: run.attempt
                        }))
                        else forwardTaskDiagnostic(event, run.requestId, String(run.id))
                    } catch { nativeError(line) }
                }
            })
        }
        worker.done = new Promise<void>(resolveDone => {
            let handled = false
            const exited = (cause?: Error) => {
                if (handled) return
                handled = true
                if (cause || child.exitCode !== 0 && !stopped) reportDiagnostic('task_scheduler', run.requestId, cause ?? new Error('TASK_WORKER_EXIT'), {runId: String(run.id), exitCode: child.exitCode, signal: child.signalCode})
                // 等待事务锁释放后才确认终态；数据库不可用时保留未知状态供租约恢复。
                void finishTask(db, run.id, run.token, stopped ? 'interrupted' : 'failed', stopped ? 'OWNER_LOST' : 'WORKER_EXIT')
                    .catch(cause => report(cause, {requestId: run.requestId, runId: String(run.id)})).finally(() => {
                        workers.delete(String(run.id));
                        resolveDone()
                    })
            }
            child.once('error', exited);
            child.once('close', () => exited())
        })
        workers.set(String(run.id), worker)
    }

    async function tick() {
        const db = getDatabase(), now = new Date()
        for (const task of await repo.all(db)) {
            if (!(taskCodes as readonly string[]).includes(task.code)) continue
            if (task.activeRunId !== null) {
                const local = workers.get(String(task.activeRunId))
                if (local) {
                    const commands = await repo.pendingCommands(db, task.activeRunId)
                    const pending = commands.filter(c => !c.handledAt && c.token === local.run.token)
                    if (pending.some(c => c.action === 'force') && !local.forceSent) {
                        local.forceSent = true;
                        local.child.kill('SIGKILL')
                    } else if (pending.some(c => c.action === 'stop') && local.child.connected) local.child.send({type: 'stop'}, () => {
                    })
                    // 控制请求先于心跳；心跳可能等待当前批次行锁，不阻塞下一轮控制轮询。
                    if (!local.heartbeat) local.heartbeat = repo.renewLease(db, task.id, local.run.id, local.run.token, ownerId, now, new Date(Date.now() + LEASE_MS))
                        .then(() => {
                        }).catch(cause => report(cause, {requestId: local.run.requestId, runId: String(local.run.id)})).finally(() => {
                            local.heartbeat = undefined
                        })
                } else if (task.ownerId === null) {
                    const run = await claimQueuedTask(db, task.id, ownerId, now)
                    if (run) await launch(db, run)
                } else if ((!task.leaseUntil || task.leaseUntil <= now) && !recovering.has(String(task.id))) {
                    recovering.add(String(task.id))
                    void finishTask(db, task.activeRunId, task.activeToken ?? '', 'interrupted', 'OWNER_LOST', now, true).catch(cause => report(cause, {runId: String(task.activeRunId)})).finally(() => recovering.delete(String(task.id)))
                }
            } else {
                await scheduleDueTask(db, task.id, now)
            }
        }
        // 已结束执行的迟到控制请求不能影响后续执行，也不能阻止记录永久回收。
        await repo.acknowledgeFinishedCommands(db, terminalRunStatuses, now)
    }

    function schedule() {
        if (stopped) return
        timer = setTimeout(() => {
            ticking = tick().catch(report).finally(() => {
                ticking = undefined;
                schedule()
            })
        }, TASK_POLL_MS)
        timer.unref?.()
    }

    schedule()
    return async () => {
        stopped = true;
        clearTimeout(timer);
        await ticking
        const active = [...workers.values()]
        for (const w of active) if (w.child.connected) w.child.send({type: 'stop'}, () => {
        })
        let timeout: ReturnType<typeof setTimeout> | undefined
        await Promise.race([Promise.all(active.map(w => w.done)), new Promise<void>(resolveTimeout => {
            timeout = setTimeout(resolveTimeout, TASK_SHUTDOWN_GRACE_MS)
        })])
        clearTimeout(timeout)
        for (const w of active) if (w.child.exitCode === null && w.child.signalCode === null) w.child.kill('SIGKILL')
        await Promise.all(active.map(w => w.done))
        await Promise.all(active.map(w => w.heartbeat))
    }
}
