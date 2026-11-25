// CLI 与测试共用迁移执行器；同库互斥并严格核验迁移凭据，不自动认领未知数据库。
import {createHash} from 'node:crypto'
import {migrate} from 'drizzle-orm/mysql2/migrator'
import {readMigrationManifest,readMigrationHistory,requireMigrationState} from './database.mjs'

export async function migrateDatabase(client, folder) {
    const connection=await client.pool.getConnection()
    let lockName,locked=false
    try {
        const [[identity]]=await connection.query('SELECT DATABASE() AS name')
        lockName='schema-migration:'+createHash('sha256').update(identity.name).digest('hex').slice(0,32)
        const [[lock]]=await connection.query('SELECT GET_LOCK(?, 0) AS acquired',[lockName])
        if(Number(lock.acquired)!==1)throw new Error('DB_MIGRATION_BUSY')
        locked=true
        const manifest=readMigrationManifest(folder)
        const state=await readMigrationHistory(client.pool,manifest)
        requireMigrationState(state,true)
        await migrate(client.database,{migrationsFolder:folder})
        requireMigrationState(await readMigrationHistory(client.pool,manifest))
    } finally {
        try {if(locked)await connection.query('SELECT RELEASE_LOCK(?)',[lockName])}
        finally {connection.release()}
    }
}
