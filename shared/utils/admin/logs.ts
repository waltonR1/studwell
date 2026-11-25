// 两端共用的日志动作目录查询与名称回退。
import {loginActions, securityActions, auditActions} from '../../config/admin/logs'
import type {LogKind} from '../../types/admin/logs'

export function logActionCatalog(kind: LogKind): Record<string, string> {
    return kind === 'login' ? loginActions : kind === 'security' ? securityActions : auditActions
}

export function logActionName(kind: LogKind, code: string) {
    return logActionCatalog(kind)[code] ?? '其他事件'
}
