// 封装公开咨询分类读取与提交，不管理表单和提示状态。
import type {InquirySubmission, PublicInquiryCategory} from '#shared/schemas/public/inquiries'
import type {ApiResponse} from '#shared/types/api'
import {usePublicApiFetch, type PublicFetchOptions} from './http'

export function usePublicInquiryCategoriesApi(options: PublicFetchOptions<PublicInquiryCategory[]>) {
    return usePublicApiFetch<PublicInquiryCategory[]>('inquiries/categories', options)
}

export function submitPublicInquiryApi(body: InquirySubmission) {
    return $fetch<ApiResponse<{ id: string }>>('/api/public/inquiries', {
        method: 'POST', body, ignoreResponseError: true, retry: 0,
    })
}
