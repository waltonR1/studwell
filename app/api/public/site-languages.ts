// 读取已发布的站点语言；加载时机和可用性判断由调用方负责。
import type {SiteLanguages} from '#shared/config/site-languages'
import {usePublicApiFetch, type PublicFetchOptions} from './http'

export function usePublicSiteLanguagesApi(options: PublicFetchOptions<SiteLanguages>) {
    return usePublicApiFetch<SiteLanguages>('site-languages', options)
}
