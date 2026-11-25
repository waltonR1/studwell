// 站点发布快照的语言、路由和 SEO 数据合同，供后台发布与官网读取共用。
import type {SupportedLocale} from '../../config/site-languages'

export interface WebsiteSeoEntry {
    resourceId: string
    locale: SupportedLocale
    title: string
    description: string
    indexable: boolean
    ogTitle: string
    ogDescription: string
    ogMediaId: string | null
}

export interface WebsiteSiteConfigSnapshot {
    routes: Array<{ path: string; routeNodeId: string | null; resourceId: string; enabled?: boolean }>
    seo: WebsiteSeoEntry[]
}
