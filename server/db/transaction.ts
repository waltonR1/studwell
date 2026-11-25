// Service 使用注入的 Database 组织事务；Repository 显式接收同一个 DatabaseExecutor。
import type {getDatabase} from './index'

export type Database = ReturnType<typeof getDatabase>
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
export type DatabaseExecutor = Database | DatabaseTransaction
