// 服务端数据库入口：按需创建单个连接池，调用方不自行建立连接。
import {useRuntimeConfig} from '#imports'
import {createDatabaseClient} from './client'

let pool: ReturnType<typeof createDatabaseClient>['pool'] | undefined
let database: ReturnType<typeof createDatabaseClient>['database'] | undefined

export function getDatabase() {
    if (database) return database
    const url = useRuntimeConfig().databaseUrl
    if (!url) throw new Error('Database URL is not configured')
    const client = createDatabaseClient(url)
    pool = client.pool
    database = client.database
    return database
}

export async function closeDatabase() {
    const currentPool = pool
    database = undefined
    pool = undefined
    await currentPool?.end()
}
