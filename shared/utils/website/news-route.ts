// 根据公开区块能力与路由模式生成新闻列表和详情地址，不绑定页面名称。
import {parseWebsiteRoutePattern} from './route-pattern'

type Page = { path: string; sections: readonly { capabilities: readonly string[] }[] }

export function newsDetailPath(pages: readonly Page[], listing: string, slug: string) {
    const pattern = pages.find(page => newsListingPath(page) === listing)
    if (!pattern || !/^[a-z][a-z0-9_-]{0,63}$/.test(slug)) return ''
    const path = pattern.path.replace(/:[a-z][a-z0-9_]*$/, slug)
    return pages.some(page => page.path === path) ? '' : path
}

export function newsListingPath(page: Page | undefined) {
    if (!page?.sections.some(section => section.capabilities.includes('news.article'))) return ''
    const pattern = parseWebsiteRoutePattern(page.path)
    return pattern?.parameter ? '/' + pattern.segments.join('/') : ''
}
