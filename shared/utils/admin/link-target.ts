// 后台链接选择器的目标名称与不可用提示，不进入官网链接解析链路。
import type {LinkTarget} from '../../schemas/website/link-target'
import type {SiteTarget} from '../../types/admin/site-settings'
import type {SupportedLocale as SiteLocale} from '../../config/site-languages'
import {sameLinkTarget} from '../website/link-target'

export function linkTargetLabel(value: unknown, targets: SiteTarget[], locale: SiteLocale) {
    const target = value as LinkTarget | null
    if (!target) return '不跳转'
    if (!('resourceId' in target)) return target.value
    const match = targets.find(t => sameLinkTarget(target, t.target))
    return match ? `${match.label[locale]} · ${match.path}` : '当前目标不可用'
}
