// 解析后台请求失败、映射受控提示并识别会话恢复状态；不执行请求或保存会话。
import {adminRequestMessages as messages, adminConflictMessages} from '~/config/admin/request'
import type {AdminRequestFailure} from '~/types/admin/request'
import type {ApiConflictReason, ApiFailure} from '#shared/types/api.ts'

export function getAdminRequestFailure(error: unknown): AdminRequestFailure | null {
    let current: unknown = error
    for (let depth = 0; current && depth < 3; depth++) {
        const candidate = current as {
            data?: ApiFailure
            status?: number
            statusCode?: number
            response?: { status?: number; _data?: ApiFailure }
            cause?: unknown
        }
        const response = candidate.data?.success === false
            ? candidate.data
            : candidate.response?._data?.success === false
                ? candidate.response._data
                : null
        if (response) {
            return {
                code: response.error.code,
                message: response.error.code === 'CONFLICT'
                    ? conflictMessage(response.error.reason)
                    : Object.hasOwn(messages, response.error.code) ? messages[response.error.code as keyof typeof messages] : '操作未完成，请稍后重试。',
                reason: response.error.reason,
                requestId: response.requestId,
                fields: response.error.fields?.map(field => field.message).filter(Boolean),
                status: candidate.status ?? candidate.statusCode ?? candidate.response?.status,
            }
        }
        current = candidate.cause
    }
    return null
}

export function adminRequestMessage(error: unknown) {
    const failure = getAdminRequestFailure(error)
    // 通用反馈只展示业务提示；字段错误和请求编号仍保留在结构化失败信息中。
    if (failure) return failure.requestId && (failure.code === 'INTERNAL_ERROR' || (failure.status ?? 0) >= 500)
        ? `${failure.message}（请求编号：${failure.requestId}）` : failure.message
    const candidate = error as { status?: number; statusCode?: number; response?: { status?: number } }
    const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status
    if (status === 401) return messages.UNAUTHENTICATED
    if (status === 403) return messages.FORBIDDEN
    if (status === 429) return messages.RATE_LIMITED
    if (typeof status === 'number' && status >= 500) return messages.INTERNAL_ERROR
    return '连接失败，请检查网络后重试。'
}

function conflictMessage(reason: ApiConflictReason | undefined) {
    if (reason && Object.hasOwn(adminConflictMessages, reason)) return adminConflictMessages[reason]
    return messages.CONFLICT
}

export function isSessionExpiryFailure(failure: AdminRequestFailure | null) {
    return failure?.code === 'UNAUTHENTICATED'
}

export function isPasswordChangeFailure(failure: AdminRequestFailure | null) {
    return failure?.code === 'PASSWORD_CHANGE_REQUIRED'
}

export function isCsrfFailure(failure: AdminRequestFailure | null) {
    return failure?.code === 'CSRF_REJECTED'
}

// 操作反馈不重复播报已由全局恢复横幅接管的错误；加载状态仍可使用原 message。
export function adminOperationMessage(error: unknown, hasGlobalFeedback = false) {
    if (isAdminSessionChangedError(error)) return ''
    const failure = getAdminRequestFailure(error)
    if (hasGlobalFeedback && (isCsrfFailure(failure) || isSessionExpiryFailure(failure) || isPasswordChangeFailure(failure))) return ''
    return adminRequestMessage(error)
}


export function createLocalAdminFailure(code: 'UNAUTHENTICATED' | 'PASSWORD_CHANGE_REQUIRED' | 'CSRF_REJECTED') {
    const error = new Error(messages[code])
    Object.assign(error, {
        data: {
            success: false as const,
            error: {code, message: messages[code]},
            requestId: '',
        },
    })
    return error
}

export function createAdminSessionChangedError() {
    return Object.assign(new Error('登录会话已切换，旧请求结果已丢弃。'), {name: 'AdminSessionChangedError'})
}

export function isAdminSessionChangedError(error: unknown) {
    return error instanceof Error && error.name === 'AdminSessionChangedError'
}
