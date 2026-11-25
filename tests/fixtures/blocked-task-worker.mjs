// 仅专用测试库的隔离进程夹具：模拟持锁长事务，验证真实SIGKILL回滚。
import { createConnection } from 'mysql2/promise'
import { validateTestDatabase } from '../database/connection.mjs'
validateTestDatabase(process.env)
if (process.env.STUDWELL_TASK_DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Fixture requires the dedicated test database')
const connection = await createConnection(process.env.STUDWELL_TASK_DATABASE_URL)
const id = process.env.STUDWELL_TASK_RUN_ID
await connection.beginTransaction()
await connection.query('SELECT t.id FROM admin_tasks t JOIN admin_task_runs r ON r.task_id=t.id WHERE r.id=? FOR UPDATE', [id])
await connection.query('SELECT id FROM admin_task_runs WHERE id=? FOR UPDATE', [id])
await connection.query("DELETE FROM admin_auth_logs WHERE action='force_fixture'")
await connection.query('SELECT GET_LOCK(?,0)', [`BF11A-force-${id}`])
setInterval(() => {}, 1000)
