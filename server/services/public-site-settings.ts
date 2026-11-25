// 读取一致的公开站点发布配置并投影前端装配数据。
import {readModuleImageRules} from '../repositories/website-image-rules'
import {businessLinkLocations} from './website-navigation-providers'
import {modulePolicyChecks} from '../policies/site-modules'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {readPublishedSiteContext,resolveSiteLocale,type PublishedSiteContext} from './site-languages'
import {readSeo} from '../repositories/website-site-config'
import {resolveSeo} from './public-website-seo'
import {readPublishedRoutes} from '../repositories/website-route-tree'
import {z} from 'zod'
import type {PublicLocale} from '#shared/schemas/public/queries'
import type {Database, DatabaseExecutor} from '../db/transaction'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {createPublicMediaResolver} from './public-media'
import {siteSettingsSchema, type SiteLink} from '#shared/schemas/admin/site-settings'

import {entityIdSchema} from '#shared/schemas/entity'
import {publicCodeSchema, publicLocalizedQuerySchema} from '#shared/schemas/public/queries'
import type {PublicLink, PublicMedia, PublicSiteSettings} from '#shared/types/public/website'
import {parseInput} from '../core/validation'
import {ApiError} from '../core/errors'

const sectionSchema = z.object({id: entityIdSchema, templateKey: z.string().min(1), sortOrder: z.number().int().nonnegative(), anchorKey: publicCodeSchema, visible: z.boolean()})
const pageSnapshotSchema = z.object({settings: websitePageSettingsSchema, sections: z.array(sectionSchema)})

// 仅读取当前发布快照，所有资源在同一事务内投影；不读取后台草稿或权限。
export async function publicSiteSettings(database: Database, raw: unknown): Promise<PublicSiteSettings> {
  const {locale} = await parseInput(publicLocalizedQuerySchema, raw)
  return database.transaction(tx => projectPublicSiteSettings(tx, locale), {isolationLevel: 'repeatable read'})
}

export async function projectPublicSiteSettings(tx: DatabaseExecutor, requested?: PublicLocale,preview=false,context?:PublishedSiteContext,draft?:{section:'header'|'footer';content:unknown}): Promise<PublicSiteSettings> {
  const {languages,configReleaseId,languageReleaseId}=context??await readPublishedSiteContext(tx)
  const locale=preview?requested??languages.defaultLocale:resolveSiteLocale(languages,requested)
  const imageRules=await readModuleImageRules(tx)
  const policy=await readWebsiteModulePolicy(tx)
  const checks=modulePolicyChecks(policy.policy)
  const result: PublicSiteSettings = {modulePolicyVersion:policy.version,languages,modules:policy.policy.enabled,locale, basic: null, header: null, footer: null, pages: {}}
  result.configReleaseId = configReleaseId
  result.languageReleaseId = languageReleaseId
  const routes = await readPublishedRoutes(tx)
  const seoRows = await readSeo(tx)
  const resolveMedia = createPublicMediaResolver(tx)
  const link = (value: SiteLink): PublicLink => ({id: value.id, label: value.label[locale]??'', target: {...value.target}})
  const media = async (id: string | null): Promise<PublicMedia | null> => {
    if (!id) return null
    return {...await resolveMedia(id, 'image')}
  }
  for (const resource of await resources.all(tx)) {
    const override=draft&&resource.key==='site.'+draft.section?draft:undefined
    const release=override?{content:override.content,id:resource.id}:resource.publishedReleaseId?await resources.release(tx,resource.publishedReleaseId,resource.id):null
    if(!override&&!resource.publishedReleaseId)continue
    if (!release) throw new ApiError('INTERNAL_ERROR')
    if (resource.type === 'basic') {
      const value = siteSettingsSchema.shape.basic.parse(release.content)
      result.basic = {logo: await media(value.logoId), favicon: await media(value.faviconId)}
      if(result.basic.logo)Object.assign(result.basic.logo,{presentation:value.logoPresentation,imagePreset:imageRules.logo})
      if(result.basic.favicon)Object.assign(result.basic.favicon,{presentation:value.faviconPresentation,imagePreset:imageRules.favicon})
    } else if (resource.type === 'header') {
      const value = siteSettingsSchema.shape.header.parse(release.content)
      result.header = {tagline: value.tagline[locale]??'', items: value.items.filter(item => item.visible).map(item => ({...link(item), children: item.children.filter(child => child.visible).map(link)}))}
    } else if (resource.type === 'footer') {
      const value = siteSettingsSchema.shape.footer.parse(release.content)
      result.footer = {
        contactTarget: value.contactTarget, contactTitle: value.contactTitle[locale]??'', contacts:value.contacts.filter(contact=>contact.visible&&contact.value[locale]?.trim()).map(contact=>({id:contact.id,kind:contact.kind,label:contact.label[locale]??'',value:contact.value[locale]??''})),
         description: value.description[locale]??'', copyrightHolder: value.copyrightHolder[locale]??'',
        groups: value.groups.filter(group => group.visible).map(group => ({id: group.id, title: group.title[locale]??'', items: group.items.filter(item => item.visible).map(link)})),
      }
    } else if (resource.type === 'page') {
      const key = publicCodeSchema.parse(resource.key.slice(5))
      if(!preview&&(!checks.page(key)||!checks.snapshot(release.content)))continue
      const {settings, sections} = pageSnapshotSchema.parse(release.content)
      const pagePath = routes.find(route=>route.resourceId===resource.id)?.path
      if (!pagePath) continue
      result.pages[key] = {
        linkLocations:businessLinkLocations(policy.policy,release.content),key, resourceId:String(resource.id), configReleaseId, languageReleaseId, displayName: settings.displayName[locale]??'', path: pagePath, releaseId: String(release.id), sceneEnabled:settings.sceneEnabled,sceneTransitionSeconds:settings.sceneTransitionSeconds,seo: await resolveSeo(tx,seoRows,String(resource.id),locale),
        sections: sections.filter(section => section.visible)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
          .map(({id, templateKey, sortOrder, anchorKey}) => ({id, templateKey, sortOrder, anchorKey,capabilities:policy.policy.templates[templateKey]?.provides??[]})),
      }
    }
  }
  if(!preview&&Object.values(policy.policy.enabled).some(enabled=>!enabled)){
    const reachable=new Set(Object.values(result.pages).map(page=>page.resourceId))
    const visible=({target}:PublicLink)=>!('resourceId' in target)||reachable.has(target.resourceId)
    if(result.header)result.header.items=result.header.items.filter(visible).map(item=>({...item,children:item.children.filter(visible)}))
    if(result.footer){
      result.footer.groups=result.footer.groups.map(group=>({...group,items:group.items.filter(visible)}))
      if(result.footer.contactTarget&&!visible({id:'',label:'',target:result.footer.contactTarget}))result.footer.contactTarget=null
    }
  }
  return result
}
