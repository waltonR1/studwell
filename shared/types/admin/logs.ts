// 后台日志记录与审计上下文的 API 响应契约，供服务端投影、CSV 导出与管理页面共用。
import type {logKinds, logReasonNames, logResultCodes} from '../../config/admin/logs'
import type {PageData} from '../api'

export type LogKind = typeof logKinds[number]
export type LogReasonCode = keyof typeof logReasonNames
export type LogResult = typeof logResultCodes[number]

export interface LogList extends PageData<LogRecord> {
    exportLimit: number
    range: { start: string; endExclusive: string }
}

// API 返回的审计上下文，不包含服务端校验实现。
export interface LogExportContext {
    version: 1;
    kind: LogKind;
    start: string;
    endExclusive: string
    filters: {
        requestId?: string;
        logId?: string;
        account?: string;
        actorId?: string;
        action?: string;
        result?: LogResult;
        ip?: string
    }
    rowCount: number;
    includeSources: boolean
}

export interface LogCleanupContext {
    version: 1;
    kind: LogKind;
    retentionDays: number;
    cutoff: string;
    deletedCount: number;
    batch: number;
    limitReached: boolean
}

export interface LogRecord {
    changeSummary?: string
    changeContext?: import('./log-changes').LogChangeContext | null
    reasonCode?: string | null;
    requestMethod?: string | null;
    routeTemplate?: string | null;
    permissionCode?: string | null;
    rateLimitScope?: string | null
    id: string;
    kind: LogKind;
    actorId: string | null;
    account: string | null;
    action: string;
    actionName: string;
    result: LogResult;
    createdAt: string;
    requestId: string
    cleanupContext?: LogCleanupContext | null
    targetType: string | null;
    targetId: string | null;
    targetName: string | null
    ip: string | null;
    userAgent: string | null;
    exportContext: LogExportContext | null;
    exportContextHidden: boolean
}
