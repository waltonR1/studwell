// 封装公开新闻列表、详情及浏览量接口，不管理页面状态。
import {toValue, type MaybeRefOrGetter} from 'vue'
import type {PublicNewsList} from '#shared/types/public/news-list'
import type {PublicNewsArticle} from '#shared/types/public/news'
import type {ApiResponse} from '#shared/types/api'
import {ApiTransportError} from '~/utils/api-diagnostics'
import {usePublicApiFetch, type PublicFetchOptions} from './http'

export function usePublicNewsListApi(options: PublicFetchOptions<PublicNewsList>) {
    return usePublicApiFetch<PublicNewsList>('news', options)
}

export function usePublicNewsDetailApi(slug: MaybeRefOrGetter<string>, options: PublicFetchOptions<PublicNewsArticle>) {
    return usePublicApiFetch<PublicNewsArticle>(() => `news/${encodeURIComponent(toValue(slug))}`, options)
}

export async function recordPublicNewsView(slug: string) {
    const response = await $fetch<ApiResponse<{ viewCount: number | null }>>(
        `/api/public/news/${encodeURIComponent(slug)}/view`,
        {method: 'POST'},
    )
    if (!response.success) throw new ApiTransportError('INVALID_RESPONSE', '浏览量响应无效')
    return response.data
}
