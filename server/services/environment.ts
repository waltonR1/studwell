// 协调environment业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import type {Database} from '../db/transaction'
import {getPermissionSnapshot} from './access/permissions'
import {ApiError} from '../core/errors'
import {environmentCollector} from '../infrastructure/environment-collector'

export function createEnvironmentService(database: Database, collector = environmentCollector) {
    return {
        async overview(actor: bigint) {
            const current = await getPermissionSnapshot(database, actor)
            if (!current.permissions.includes('system.environment.read')) throw new ApiError('FORBIDDEN')
            return collector.snapshot()
        },
    }
}
