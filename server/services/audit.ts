// 协调审计业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {validateAuditChanges} from '../schemas/log-changes'
import {logFailureReason} from '../policies/log-reasons'
// 使用调用者传入的事务，不自行申请连接。成功审计失败必须继续抛出，让业务回滚。
import type {DatabaseExecutor} from '../db/transaction'
import {auditRepository, type AuditInput} from '../repositories/audit'
import {reportDiagnostic} from '../infrastructure/diagnostics'
import {ApiError} from '../core/errors'

export const auditService = {
    async write(db: DatabaseExecutor, input: AuditInput) {
        try {
            return await auditRepository.audit(db, {...input, changeContext: input.result === 'success' && input.changeContext ? validateAuditChanges(input.changeContext, input.targetType) : null})
        } catch (cause) {
            reportDiagnostic(input.result === 'failed' ? 'audit_failure' : 'audit_success', input.requestId, cause);
            throw cause
        }
    },
    async failure(db: DatabaseExecutor, input: AuditInput, original: unknown) {
        try {
            const id = await auditService.write(db, {...input, reasonCode: logFailureReason(original)})
            reportDiagnostic('operation_failure', input.requestId, original, {logId: String(id)})
            return id
        } catch {
            reportDiagnostic('operation_failure', input.requestId, original);
            throw new ApiError('INTERNAL_ERROR')
        }
    },
}
