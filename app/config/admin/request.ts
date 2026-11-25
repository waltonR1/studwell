// 后台请求失败与冲突原因的界面提示配置；不解析异常或保存请求状态。
import type {ApiErrorCode} from '#shared/types/api-errors'
import type {ApiConflictReason} from '#shared/types/api'

export const adminRequestMessages = {
    INVALID_INPUT: '请检查填写内容。',
    INVALID_JSON: '请求内容格式不正确，本次操作未提交。',
    UNAUTHENTICATED: '登录已失效，请重新登录。',
    AUTH_FAILED: '账号或密码错误，或账号暂不可用。',
    PASSWORD_CHANGE_REQUIRED: '请先修改初始密码。',
    CSRF_REJECTED: '安全校验未通过，请刷新页面后重试。',
    FORBIDDEN: '当前账号无权执行此操作。',
    NOT_FOUND: '记录不存在，可能已被删除。',
    CONFLICT: '数据已发生变化，请刷新后重试。',
    RATE_LIMITED: '请求过于频繁，请稍后重试。',
    REQUEST_TOO_LARGE: '提交内容过大，请减少内容后重试。',
    UNSUPPORTED_MEDIA_TYPE: '提交格式不正确，请刷新后重试。',
    EXPORT_LIMIT_EXCEEDED: '导出数量超过当前上限，请缩小筛选范围。',
    INTERNAL_ERROR: '服务暂时不可用，请稍后重试。',
    TASK_BUSY: '任务已排队或正在执行，请查看执行记录。',
    TASK_FINISHED: '该次执行已结束，请刷新记录。',
    TASK_SCHEDULER_OFFLINE: '任务调度器暂未在线，请稍后重试。',
    TASK_EXECUTION_DISABLED: '当前环境未开放任务执行。',
} as const satisfies Record<ApiErrorCode, string>

export const adminConflictMessages = {
    STALE: '记录已更新，请刷新后重试；未保存内容已保留。',
    DUPLICATE: '该信息已被占用，请修改后重试。',
    DEPENDENCY_UNAVAILABLE: '已发布区块依赖的业务能力不可用，请先发布提供该能力的页面，或移除依赖区块。',
    PAGE_LINKED: '页头或页脚仍有已发布链接，请先调整并发布导航，再下线页面。',
    PAGE_CONFIGURED: '页面仍有区块或发布历史，不能删除菜单。请清空区块并保存；有发布历史时请改为隐藏入口。',
    REFERENCED: '记录仍被引用或包含子项，请先处理关联后重试。',
    RETRY: '本次操作未完成，请稍后重试。',
} as const satisfies Record<ApiConflictReason, string>
