// 仅受控错误可对外展示；未知异常一律隐藏内部信息。
import type {ApiErrorCode} from '#shared/types/api-errors.ts'
import type {ApiConflictReason, ApiFieldError} from '#shared/types/api.ts'

const definitions = {
    INVALID_INPUT: [400, '请求参数不正确'],
    INVALID_JSON: [400, '请求体必须是有效的 JSON'],
    UNAUTHENTICATED: [401, '请先登录'],
    AUTH_FAILED: [401, '账号或密码错误，或账号暂不可用'],
    PASSWORD_CHANGE_REQUIRED: [403, '请先修改初始密码'],
    CSRF_REJECTED: [403, '请求来源或安全校验失败，请刷新后重试'],
    REQUEST_TOO_LARGE: [413, '请求内容过大'],
    FORBIDDEN: [403, '没有执行此操作的权限'],
    NOT_FOUND: [404, '请求的资源不存在'],
    CONFLICT: [409, '数据已发生变化，请刷新后重试'],
    UNSUPPORTED_MEDIA_TYPE: [415, '请求体必须使用 application/json'],
    RATE_LIMITED: [429, '请求过于频繁，请稍后重试'],
    EXPORT_LIMIT_EXCEEDED: [422, '导出数量超过当前上限，请缩小筛选范围后重试'],
    INTERNAL_ERROR: [500, '服务暂时不可用，请稍后重试'],
    TASK_BUSY: [409, '任务已有排队或运行中的执行，请查看执行记录'],
    TASK_FINISHED: [409, '该次执行已结束，请刷新记录'],
    TASK_SCHEDULER_OFFLINE: [503, '调度器暂未在线，无法提交执行请求'],
    TASK_EXECUTION_DISABLED: [403, '当前开发或测试环境未开放任务执行'],
} as const satisfies Record<ApiErrorCode, readonly [number, string]>

export class ApiError extends Error {
    readonly status: number

    constructor(readonly code: ApiErrorCode, readonly fields?: ApiFieldError[], readonly retryAfter?: number, readonly reason?: ApiConflictReason) {
        super(definitions[code][1])
        this.status = definitions[code][0]
    }
}

// 仅服务端诊断使用；HTTP 响应继续遵循 INTERNAL_ERROR 合同。
export class ConfigurationError extends ApiError {
    constructor(readonly diagnosticCode: 'PARAMETER_SEED_REQUIRED') {
        super('INTERNAL_ERROR')
    }
}

export function conflictError(reason: ApiConflictReason, field?: string) {
    const messages: Record<ApiConflictReason, string> = {
        STALE: '记录已被其他操作更新，请刷新最新版本后核对。',
        DUPLICATE: '唯一字段已被占用，请修改后重试。',
    DEPENDENCY_UNAVAILABLE: '已发布区块依赖的业务能力不可用，请先发布提供该能力的页面，或移除依赖区块。',
    PAGE_LINKED: '页头或页脚仍有已发布链接，请先调整并发布导航，再下线页面。',
    PAGE_CONFIGURED: '页面仍有区块或发布历史，不能删除菜单。请清空区块并保存；有发布历史时请隐藏入口。',
        REFERENCED: '记录仍被引用或包含子项，请先处理关联后重试。',
        RETRY: '数据库事务发生冲突或死锁，本次写入未完成。请稍后重试。',
    }
    return new ApiError('CONFLICT', field ? [{path: field, message: messages[reason]}] : undefined, undefined, reason)
}
