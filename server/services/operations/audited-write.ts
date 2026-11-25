// 协调业务写入与成功审计同事务提交，并记录失败审计。
import type {Database, DatabaseTransaction} from '../../db/transaction'
import type {AuthMeta} from '../../core/auth-context'
import type {LogChangeContext} from '#shared/types/admin/log-changes'
import {auditService} from '../audit'
import {conflictError} from '../../core/errors'
import {databaseConflictField, databaseConflictReason} from '../../core/db-errors'

export interface AuditedResult<T> {
    value: T;
    id: bigint | string;
    name: string;
    changes: LogChangeContext;
    auditAction?: string
}
export async function auditedWrite<T>(database: Database, operation: {
    actor: bigint; meta: AuthMeta; action: string; id: bigint | string | null; targetType: 'menu' | 'role' | 'media' | 'site_settings' | 'news' | 'careers' | 'inquiry'; targetName?: string; isolationLevel?: 'read committed'
}, work: (tx: DatabaseTransaction) => Promise<AuditedResult<T>>) {
    const {actor, meta, action, id, targetType} = operation
    try {
        return await database.transaction(async tx => {
            const result = await work(tx)
            await auditService.write(tx, {...meta, actorId: actor, action: result.auditAction ?? action, targetType,
                targetId: String(result.id), targetName: result.name.slice(0, 80), changeContext: result.changes, result: 'success', createdAt: new Date()})
            return result.value
        }, operation.isolationLevel ? {isolationLevel: operation.isolationLevel} : undefined)
    } catch (error) {
        await auditService.failure(database, {...meta, actorId: actor, action, targetType,
            targetId: id === null ? null : String(id), targetName: operation.targetName, result: 'failed', createdAt: new Date()}, error)
        const reason = databaseConflictReason(error)
        if (reason) throw conflictError(reason, databaseConflictField(reason))
        throw error
    }
}
