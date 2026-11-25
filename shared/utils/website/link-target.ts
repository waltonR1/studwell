// 通用链接比较与公开地址解析，后台标签文案单独位于 utils/admin/link-target。
import type {LinkTarget} from '../../schemas/website/link-target'
import {sitePagePath} from './site-link'

export function sameLinkTarget(a: Exclude<LinkTarget, { type: 'custom' }>, b: Exclude<LinkTarget, { type: 'custom' }>) {
    return a.type === b.type && a.resourceId === b.resourceId && a.module === b.module && a.value === b.value
}

export function resolveLinkTarget(target: LinkTarget | null, pages: Array<{
    resourceId: string;
    path: string;
    linkLocations?: Record<string, { queryKey: string; anchorKey: string | null }>
}>): string {
    if (!target) return ''
    if (!('resourceId' in target)) return target.value
    const page = pages.find(p => p.resourceId === target.resourceId)
    return page ? sitePagePath(target, page) : ''
}
