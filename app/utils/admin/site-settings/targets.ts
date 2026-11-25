import type {SiteTarget} from '#shared/types/admin/site-settings'
// Keep each page's destinations together, preserving the catalog's page and child order.
export function orderedSiteTargets(targets: SiteTarget[]): SiteTarget[] {
  const modules = [...new Set(targets.map(item => item.target.module))]
  return modules.flatMap(module => {
    const items = targets.filter(item => item.target.module === module)
    return [
      ...items.filter(item => item.target.type === 'page'),
      ...items.filter(item => item.target.type !== 'page'),
    ]
  })
}
