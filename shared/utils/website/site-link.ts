// 根据公开页面路径及业务入口投影生成链接，并校验自定义站内外地址。

import type {SitePageTarget} from '../../types/website/link-target'

export function sitePageLocation(target: SitePageTarget, page: {
    path: string;
    linkLocations?: Record<string, { queryKey: string; anchorKey: string | null }>
}): { path: string; query?: Record<string, string>; hash?: string } {
    const path = page.path
    if (target.type === 'anchor') return {path, hash: `#${target.value}`}
    if (target.type === 'page') return {path}
    const location = page.linkLocations?.[target.type]
    if (!location) throw new Error('Business link location is unavailable')
    return {
        path,
        query: {[location.queryKey]: target.value}, ...(location.anchorKey ? {hash: '#' + location.anchorKey} : {})
    }
}

export function sitePagePath(target: SitePageTarget, page: {
    path: string;
    linkLocations?: Record<string, { queryKey: string; anchorKey: string | null }>
}) {
    const {path, query, hash} = sitePageLocation(target, page)
    const search = query ? new URLSearchParams(query).toString() : ''
    return path + (search ? `?${search}` : '') + (hash ?? '')
}

export function isExternalSiteLink(value: string) {
    return /^https?:\/\/[^/\\\s]/i.test(value) && !/[\\\s]/.test(value) && !hasControlCharacters(value) && URL.canParse(value)
}

function hasControlCharacters(value: string) {
    return Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
}

export function isSiteLinkAddress(value: string) {
    return (/^\/(?!\/)[^\\\s]*$/.test(value) && !hasControlCharacters(value)) || isExternalSiteLink(value)
}
