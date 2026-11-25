// 负责审计的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {withEntityIds} from '../db/allocate-entity-id'
import type {LogResult} from '#shared/types/admin/logs'
import {requireLogResult} from '../policies/log-result'
import {adminOperationLogs} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export type AuditInput = Omit<typeof adminOperationLogs.$inferInsert, 'result'> & {result: Exclude<LogResult, 'denied'>}
export const auditRepository = {
    async audit(db: DatabaseExecutor, input: AuditInput) {
        const row = await withEntityIds(db, 'admin_operation_logs', {
            actorId: input.actorId,
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId,
            targetName: input.targetName,
            result: requireLogResult(input.result, 'audit'),
            reasonCode: input.reasonCode,
            ip: input.ip,
            userAgent: input.userAgent,
            requestId: input.requestId,
            createdAt: input.createdAt,
            exportContext: input.exportContext,
            cleanupContext: input.cleanupContext,
            changeContext: input.changeContext
        })
        await db.insert(adminOperationLogs).values(row)
        return row.id
    },
}
