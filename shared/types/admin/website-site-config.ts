// 后台路由与 SEO 配置树及草稿、在线版本响应，SEO 字段复用公共站点合同。
import type {WebsiteSeoEntry} from '../website/site-config'
import type {WebsiteRouteNode} from '../website/route'
import type {PublicationRelease} from './publication-history'

// 管理接口复用站点 SEO 字段，避免草稿和发布快照重复定义。
export type WebsiteSiteSeoEntry = Omit<WebsiteSeoEntry, 'resourceId'>
export type WebsiteSiteSeo = WebsiteSeoEntry

export interface WebsiteSiteConfigTree {
    modulePolicy: { version: number; policy: import('../../schemas/website/module-policy').WebsiteModulePolicy }
    draft: Array<WebsiteRouteNode & { path: string }>
    online: Array<{ path: string; routeNodeId: string | null }>
    pages: Array<{ id: string; key: string; published: boolean }>
    version: number
    publishedReleaseId: string | null
    releases: PublicationRelease[]
    seo: WebsiteSiteSeo[]
    publishedSeo: WebsiteSiteSeo[]
}
