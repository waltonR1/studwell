// 负责后台统计的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and, count, eq, gte, isNull, lt, notInArray} from 'drizzle-orm'
import {adminUsers, adminRoles, adminDictionaries, adminAuthLogs, adminOperationLogs} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import type {DashboardMetricKey} from '#shared/types/admin/dashboard.ts'
import {loginActions} from '#shared/config/admin/logs.ts'

export const dashboardRepository = {
    async count(db: DatabaseExecutor, key: DashboardMetricKey, range: { start: Date; end: Date }) {
        if (key === 'users') {
            const [row] = await db.select({value: count()}).from(adminUsers).where(isNull(adminUsers.deletedAt));
            return row!.value
        }
        if (key === 'roles') {
            const [row] = await db.select({value: count()}).from(adminRoles);
            return row!.value
        }
        if (key === 'dictionaries') {
            const [row] = await db.select({value: count()}).from(adminDictionaries);
            return row!.value
        }
        if (key === 'auditToday') {
            const [row] = await db.select({value: count()}).from(adminOperationLogs).where(and(gte(adminOperationLogs.createdAt, range.start), lt(adminOperationLogs.createdAt, range.end)));
            return row!.value
        }
        const filter = key === 'securityToday' ? notInArray(adminAuthLogs.action, Object.keys(loginActions)) : and(eq(adminAuthLogs.action, 'login'), eq(adminAuthLogs.result, key === 'loginSuccess' ? 'success' : 'failed'))
        const [row] = await db.select({value: count()}).from(adminAuthLogs).where(and(gte(adminAuthLogs.createdAt, range.start), lt(adminAuthLogs.createdAt, range.end), filter))
        return row!.value
    },
}
