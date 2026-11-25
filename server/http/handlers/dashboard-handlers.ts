// 适配后台统计的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createDashboardService} from '../../services/dashboard'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {requestActor} from '../auth'

export function dashboardHandlers(database: Database, clock = () => new Date()) {
    const dashboard = createDashboardService(database, clock), auth = createAuthService(database)
    return {
        overview: defineApiHandler(async event => {
            await parseInput(z.strictObject({}), getQuery(event))
            return dashboard.overview(await requestActor(event, auth))
        }),
    }
}
