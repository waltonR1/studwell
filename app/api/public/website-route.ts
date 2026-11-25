// 解析公开访问路径对应的发布目标，不负责页面装配。
import {usePublicApiFetch} from './http'

interface WebsiteRouteTarget {
    configReleaseId: string | null
    languageReleaseId?: string | null
    path: string
    pageKey: string
    targetType: string
    targetKey: string
}

export function usePublicWebsiteRouteApi(path: string) {
    return usePublicApiFetch<WebsiteRouteTarget>('website-route', {query: {path}})
}
