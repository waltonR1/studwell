// 封装公开招聘岗位接口，不管理筛选或页面状态。
import type {PublicCareerPosition} from '#shared/types/public/careers'
import {usePublicApiFetch, type PublicFetchOptions} from './http'

export function usePublicCareerPositionsApi(options: PublicFetchOptions<PublicCareerPosition[]>) {
    return usePublicApiFetch<PublicCareerPosition[]>('careers', options)
}
