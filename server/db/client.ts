// CLI 与 Nuxt 共用连接工厂；驱动解析和 MySQL 会话时区均为 UTC。
import {createPool} from 'mysql2/promise'
import {drizzle} from 'drizzle-orm/mysql2'
import * as schema from './schema'

export function createDatabaseClient(url: string, connectionLimit = 5) {
    const pool = createPool({
        uri: url,
        connectionLimit,
        maxIdle: connectionLimit,
        idleTimeout: 60000,
        connectTimeout: 10000,
        charset: 'utf8mb4',
        timezone: 'Z',
        supportBigNumbers: true,
        bigNumberStrings: true,
        multipleStatements: false
    })
    pool.pool.on('connection', connection => {
        connection.query("SET time_zone = '+00:00'", error => {
            if (error) connection.destroy()
        })
    })
    return {pool, database: drizzle(pool, {schema, mode: 'default'})}
}
