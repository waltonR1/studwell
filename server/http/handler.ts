// 统一 API 响应及异常转换，不装配业务服务。
import {reportDiagnostic} from '../infrastructure/diagnostics'
// HTTP 边界统一响应；认证/授权仍须由各入口在调用 Service 前执行。
import {defineEventHandler, setResponseHeader, setResponseStatus, type H3Event} from 'h3'
import type {ApiResponse} from '#shared/types/api.ts'
import {ApiError} from '../core/errors'
import {ensureRequestId} from './request-id'

export function defineApiHandler<T>(handler: (event: H3Event) => T | Promise<T>) {
    return defineEventHandler(async (event): Promise<ApiResponse<T>> => {
        const requestId = ensureRequestId(event)
        setResponseHeader(event, 'Cache-Control', 'no-store')
        try {
            const data = await handler(event)
            // 在 HTTP 边界捕获遗漏返回值、循环对象和未转换的 bigint，避免框架序列化时旁路错误合同。
            if (data === undefined) throw new ApiError('INTERNAL_ERROR')
            JSON.stringify(data)
            return {success: true, data, requestId}
        } catch (cause) {
            return apiErrorResponse(event, cause)
        }
    })
}

// 中间件拒绝与 Handler 错误使用同一安全合同。
export function apiErrorResponse(event: H3Event, cause: unknown) {
    const requestId = ensureRequestId(event)
    const error = cause instanceof ApiError ? cause : new ApiError('INTERNAL_ERROR')
    setResponseHeader(event, 'Cache-Control', 'no-store')
    if (error.retryAfter) setResponseHeader(event, 'Retry-After', error.retryAfter)
    if (error.status === 500) {
        // 技术详情仅进入服务端受限诊断；客户端继续使用通用错误合同。
        reportDiagnostic('api', requestId, cause)
    }
    setResponseStatus(event, error.status)
    return {
        success: false as const,
        error: {
            code: error.code,
            message: error.message, ...(error.reason ? {reason: error.reason} : {}), ...(error.fields ? {fields: error.fields} : {})
        },
        requestId,
    }
}
