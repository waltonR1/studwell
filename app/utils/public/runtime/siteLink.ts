// 将站点导航配置转换为可访问链接。
import type {PublicLinkTarget, PublicSiteSettings} from '#shared/types/public/website'
import {sitePageLocation} from '#shared/utils/website/site-link'

export function siteLink(target: PublicLinkTarget, settings: PublicSiteSettings): ReturnType<typeof sitePageLocation> & {address?: string} {
  if (!('resourceId' in target)) return {path: '', address: target.value}
  const page = Object.values(settings.pages).find(page=>page.resourceId===target.resourceId)
  if (!page) return {path: ''}
  return sitePageLocation(target,page)
}
