// 单次执行的独立进程入口，由构建生成task-worker.mjs；不启动HTTP服务。
import {createDatabaseClient} from '../db/client'
import {reportDiagnostic} from '../infrastructure/diagnostics'
import {executeTask} from '../services/tasks/executor'

const id = process.env.STUDWELL_TASK_RUN_ID ?? '', token = process.env.STUDWELL_TASK_TOKEN ?? '',
    url = process.env.STUDWELL_TASK_DATABASE_URL ?? ''
if (!/^[1-9]\d{0,19}$/.test(id) || !/^[a-f0-9-]{36}$/.test(token) || !url || !process.send) process.exit(1)
let stop = false
process.on('message', message => {
    if (message && typeof message === 'object' && 'type' in message && message.type === 'stop') stop = true
})
process.on('disconnect', () => {
    stop = true
})
let client: ReturnType<typeof createDatabaseClient> | undefined
try {
    client = createDatabaseClient(url, 1)
    await executeTask(client.database, BigInt(id), token, () => stop)
} catch (cause) {
    reportDiagnostic('task_execution', process.env.STUDWELL_TASK_REQUEST_ID, cause, {runId: id})
    process.exitCode = 1
} finally {
    await client?.pool.end().catch(cause => {
        reportDiagnostic('task_execution', process.env.STUDWELL_TASK_REQUEST_ID, cause, {runId: id})
        process.exitCode = 1
    });
    if (process.connected) process.disconnect?.()
}
