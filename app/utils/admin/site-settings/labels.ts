import {sameLinkTarget} from '#shared/utils/website/link-target'
import type {SiteLink, SiteLocale} from '#shared/schemas/admin/site-settings'
import type {SiteTarget} from '#shared/types/admin/site-settings'
export function siteTargetLabel(link: SiteLink, targets: SiteTarget[], locale: SiteLocale) {
    const target = link.target
    if (!('resourceId' in target)) return target.value
    return targets.find(item => sameLinkTarget(item.target,target))?.label[locale]
        || link.label[locale] || '链接目标'
}
