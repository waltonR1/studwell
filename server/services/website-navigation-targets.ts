// 汇总站内导航目标，供后台选择，不生成前端组件。
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {sitePageEnabled,siteSnapshotEnabled} from './site-modules'
import {parseWebsiteRoutePattern} from '#shared/utils/website/route-pattern'
import {readPublishedRoutes} from '../repositories/website-route-tree'
import type {DatabaseExecutor} from '../db/transaction'
import {menuRepository} from '../repositories/menus'
import {websitePageKey} from '#shared/utils/website/page-layouts'
import {websiteResourceRepository} from '../repositories/website-resources'
import {siteTargetKey} from '../policies/site-navigation'
import {siteLocales, type SiteLocale} from '#shared/schemas/admin/site-settings'
import type {SiteTarget} from '#shared/types/admin/site-settings'

import {websiteBusinessNavigationEntries} from './website-navigation-providers'

// Published database snapshots are the only source of available destinations.
export async function websiteNavigationTargets(db: DatabaseExecutor): Promise<SiteTarget[]> {
 const result: SiteTarget[] = []
 const published=await readPublishedRoutes(db)
 const menuRows = (await menuRepository.all(db)).sort((a,b) => a.sortOrder-b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
 const menus: typeof menuRows = []
 const visit = (parentId: bigint | null) => {
  for (const menu of menuRows.filter(item => item.parentId === parentId)) {
   if (menu.pageKey === 'website_page') menus.push(menu)
   visit(menu.id)
  }
 }
 visit(null)
 const pages = (await websiteResourceRepository.all(db)).filter(resource => resource.type === 'page' && resource.publishedReleaseId)
 const rank = (key: string) => {const index=menus.findIndex(menu => websitePageKey(menu.code) === key.slice(5)); return index < 0 ? menus.length : index}
 pages.sort((a,b) => rank(a.key)-rank(b.key))
 for (const resource of pages) {
  const release = await websiteResourceRepository.release(db,resource.publishedReleaseId!,resource.id)
  if (!release||!await sitePageEnabled(db,resource.key.slice(5))||!await siteSnapshotEnabled(db,release.content)) continue
  const snapshot = release.content as {settings: unknown; sections: Array<{templateKey: string; anchorKey: string; visible: boolean; name: string}>}
  const settings = websitePageSettingsSchema.parse(snapshot.settings)
  const module = resource.key.slice(5)
  const routes=published.filter(route=>route.resourceId===resource.id)
  const pagePath=routes[0]?.path
  if (!pagePath || parseWebsiteRoutePattern(pagePath)?.parameter) continue
  const route = {path: pagePath,sections: snapshot.sections.filter(s=>s.visible)}
  const text = (value: string) => Object.fromEntries(siteLocales.map(locale => [locale,value])) as Record<SiteLocale,string>
  const add = (type: SiteTarget['target']['type'],value: string,label: Record<string,string>, path = pagePath) => {
   const target={module,type,value,resourceId:String(resource.id)}
   result.push({key:siteTargetKey(target),target,label,resourceId:String(resource.id),path})
  }
  add('page','',settings.displayName)
  for(const entry of await websiteBusinessNavigationEntries(db,release.content,{module,resourceId:String(resource.id),path:pagePath}))add(entry.type,entry.value,entry.label,entry.path)
  for (const section of route.sections){
   const path=pagePath
   if(path)add('anchor',section.anchorKey,text(section.name),path+'#'+section.anchorKey)
  }

 }
 return result
}
