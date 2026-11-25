// 协调后台统计业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import type {Database} from '../db/transaction'
import {dashboardRepository as repo} from '../repositories/dashboard'
import {getPermissionSnapshot} from './access/permissions'
import {ApiError} from '../core/errors'
import {dashboardMetricPermissions} from '../config/dashboard'
import {logDateRange} from '../policies/log-time'
import type {DashboardData, DashboardMetricKey} from '#shared/types/admin/dashboard.ts'

export function createDashboardService(database: Database, clock = () => new Date()) {
    return {
        async overview(actor: bigint): Promise<DashboardData> {
            // 短只读事务保持授权及各项计数的同一快照；不写普通GET审计，不缓存权限或统计。
            return database.transaction(async tx => {
                const current = await getPermissionSnapshot(tx, actor)
                if (!current.permissions.includes('system.dashboard.read')) throw new ApiError('FORBIDDEN')
                const now = clock(), range = logDateRange({period: 'today'}, now), stats: DashboardData['stats'] = {}
                for (const key of Object.keys(dashboardMetricPermissions) as DashboardMetricKey[]) {
                    if (current.permissions.includes(dashboardMetricPermissions[key])) stats[key] = await repo.count(tx, key, range)
                }
                return {
                    stats,
                    updatedAt: now.toISOString(),
                    range: {start: range.start.toISOString(), endExclusive: range.end.toISOString()}
                }
            }, {isolationLevel: 'repeatable read'})
        },
    }
}
