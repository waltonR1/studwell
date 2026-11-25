// 读取公开站点装配配置，不管理站点响应式状态。
import type {PublicSiteSettings} from '#shared/types/public/website'
import {usePublicApiFetch, type PublicFetchOptions} from './http'

export function usePublicSiteSettingsApi(options: PublicFetchOptions<PublicSiteSettings>) {
    return usePublicApiFetch<PublicSiteSettings>('site-settings', options)
}
