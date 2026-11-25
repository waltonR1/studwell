import type {PublicLinkTarget, PublicPageStructure, PublicSiteSettings} from '#shared/types/public/website'
import {isExternalSiteLink, isSiteLinkAddress} from '#shared/utils/website/site-link'
import {resolveLinkTarget} from '#shared/utils/website/link-target'

export type BreadcrumbItem = {label: string; to?: string}

// 公开配置中的导航父子关系提供栏目名称，页面名称始终来自当前页面。
export function pageBreadcrumbs(
  page: PublicPageStructure | undefined,
  settings: PublicSiteSettings | null,
  homeLabel: string,
  fallbackTitle: string,
): BreadcrumbItem[] {
  const currentLabel = page?.displayName || fallbackTitle
  const items: BreadcrumbItem[] = [{label: homeLabel, to: '/'}]

  if (page && settings) {
    const matchesPage = (target: PublicLinkTarget) => {
      if ('resourceId' in target) return target.resourceId === page.resourceId
      if (!isSiteLinkAddress(target.value) || isExternalSiteLink(target.value)) return false
      return new URL(target.value, 'https://site.invalid').pathname === page.path
    }
    const parent = settings.header?.items.find(item => item.children.some(child => matchesPage(child.target)))
      ?? settings.header?.items.find(item => item.children.length && matchesPage(item.target))

    if (parent && parent.label !== currentLabel) {
      const to = resolveLinkTarget(parent.target, Object.values(settings.pages))
      items.push({label: parent.label, ...(to ? {to} : {})})
    }
  }

  items.push({label: currentLabel})
  return items
}
