// 读取已发布页面并投影正文及媒体，保持发布版本一致。
import {emptySectionContent} from '#shared/utils/website/page-layouts'
import {readWebsiteModulePolicy} from '../repositories/website-module-policy'
import {businessLinkLocations} from './website-navigation-providers'
import {modulePolicyChecks} from '../policies/site-modules'
import {sectionContentSchema} from '#shared/schemas/website/section-content'
import {websiteRendererPaths} from './website-renderers'
import {sitePageEnabled,siteSnapshotEnabled} from './site-modules'
import {readPublishedSiteContext,resolveSiteLocale,type PublishedSiteContext} from './site-languages'
import type {LinkTarget} from '#shared/schemas/website/link-target'
import {resolveLinkTarget} from '#shared/utils/website/link-target'
import {readPublishedRoutes} from '../repositories/website-route-tree'
import type {PublicLocale} from '#shared/schemas/public/queries'
import type {Database, DatabaseExecutor} from '../db/transaction'
import type {SectionField} from '#shared/types/website/section-template'
import type {PublicContentValue, PublicImageReference, PublicMedia, PublicPage, PublicSection} from '#shared/types/public/website'
import {publicLocalizedQuerySchema, publicPageParamsSchema} from '#shared/schemas/public/queries'

import {imagePresentationSchema} from '#shared/schemas/image-presentation'
import {hasBannerVideo} from '../policies/website-banner'
import {publishedFieldDefinition, publishedPageSnapshotSchema, type PublishedSection} from '../policies/public-website-snapshot'
import {websiteResourceRepository as resources} from '../repositories/website-resources'
import {createPublicMediaResolver} from './public-media'
import {parseInput} from '../core/validation'
import {ApiError} from '../core/errors'
import {isSectionContentComplete} from '../policies/website-pages'

export async function publicWebsitePage(database: Database, rawKey: unknown, rawQuery: unknown): Promise<PublicPage> {
  const {key} = await parseInput(publicPageParamsSchema, {key: rawKey})
  const {locale} = await parseInput(publicLocalizedQuerySchema, rawQuery)
  return database.transaction(tx => projectPublicWebsitePage(tx, key, locale), {isolationLevel: 'repeatable read'})
}

export async function projectPublicWebsitePage(tx: DatabaseExecutor, key: string, requested?: PublicLocale,context?:PublishedSiteContext): Promise<PublicPage> {
  context??=await readPublishedSiteContext(tx)
  const locale=resolveSiteLocale(context.languages,requested)
  if(!await sitePageEnabled(tx,key))throw new ApiError('NOT_FOUND')
  const resource = await resources.find(tx, `page.${key}`)
  if (!resource?.publishedReleaseId || resource.type !== 'page') throw new ApiError('NOT_FOUND')
  if (!(await readPublishedRoutes(tx)).some(route=>route.resourceId===resource.id)) throw new ApiError('NOT_FOUND')
  const release = await resources.release(tx, resource.publishedReleaseId, resource.id)
  if (!release) throw new ApiError('INTERNAL_ERROR')
  if(!await siteSnapshotEnabled(tx,release.content))throw new ApiError('NOT_FOUND')
  return projectWebsiteSnapshot(tx,key,locale,String(release.id),release.content,false,context)
}

export async function projectWebsiteSnapshot(tx:DatabaseExecutor,key:string,locale:PublicLocale,releaseId:string,raw:unknown,preview=false,context?:PublishedSiteContext):Promise<PublicPage> {
  const snapshot = publishedPageSnapshotSchema.parse(raw)
  const {policy}=await readWebsiteModulePolicy(tx)
  const checks=modulePolicyChecks(policy)
  let rendererPaths: ReturnType<typeof websiteRendererPaths> | undefined

  let linkPages:Promise<Array<{resourceId:string;path:string;linkLocations:Record<string,{queryKey:string;anchorKey:string|null}>}>>|undefined
  const resolveTarget=async(value:LinkTarget|null)=>{
   if(!value)return ''
   if(!('resourceId' in value))return resolveLinkTarget(value,[])
   linkPages??=(async()=>{const routes=await readPublishedRoutes(tx),pages=[];for(const resource of await resources.all(tx)){if(resource.type!=='page'||!resource.publishedReleaseId||!checks.page(resource.key.slice(5)))continue;const route=routes.find(route=>route.resourceId===resource.id);if(!route)continue;const release=await resources.release(tx,resource.publishedReleaseId,resource.id);if(release&&checks.snapshot(release.content))pages.push({resourceId:String(resource.id),path:route.path,linkLocations:businessLinkLocations(policy,release.content)})}return pages})()
   return resolveLinkTarget(value,await linkPages)
  }
  const media: Record<string, PublicMedia> = {}
  const resolve = createPublicMediaResolver(tx)
  const reference = async (value: PublicImageReference, kind: 'image' | 'video', preset?: PublicImageReference['imagePreset']): Promise<PublicImageReference> => {
    if (value.mediaId) media[value.mediaId] = await resolve(value.mediaId, kind)
    return {mediaId: value.mediaId, ...(kind === 'image' ? {imagePreset: preset , ...(value.presentation ? {presentation: value.presentation} : {})} : {})}
  }
  const visit = async (field: SectionField, value: unknown): Promise<PublicContentValue> => {
    if (field.kind === 'link') return resolveTarget(value as LinkTarget|null)
    if (field.kind === 'media') return {...await reference(value as PublicImageReference, field.mediaKind ?? 'image', field.imagePreset)}
    if (field.kind === 'list') return Promise.all((value as unknown[]).map(item => visit(field.item!, item)))
    if (field.kind === 'group' || field.kind === 'tree') {
      const object = value as Record<string, unknown>
      const entries = await Promise.all(Object.entries(field.fields ?? {}).filter(([key]) => object[key] !== undefined).map(async ([key, child]) => [key, await visit(child, object[key])] as const))
      const result: Record<string, PublicContentValue> = Object.fromEntries(entries)
      if (field.kind === 'tree' && Array.isArray(object.children)) result.children = await Promise.all(object.children.map(child => visit(field, child)))
      return result
    }
    return value as string | number | boolean
  }
  const project = async (section: PublishedSection): Promise<PublicSection> => {
    const fields = publishedFieldDefinition(section.definition)
    if (fields.kind !== 'group' && fields.kind !== 'tree') throw new ApiError('INTERNAL_ERROR')
    const parsed = sectionContentSchema(fields).parse(section.localized[locale]??(preview?emptySectionContent(fields):undefined))
    const videoHero = hasBannerVideo(section.videoPath ?? undefined, parsed)
    if (!preview && !isSectionContentComplete(fields, parsed, videoHero)) throw new ApiError('INTERNAL_ERROR')
    const content = await visit(fields, parsed)
    if (!content || typeof content !== 'object' || Array.isArray(content)) throw new ApiError('INTERNAL_ERROR')
    const shared: PublicSection['shared'] = {media: []}
    const slots = section.mediaSlots
    if (new Set(section.shared.media.map(slot => slot.key)).size !== section.shared.media.length || slots.length !== section.shared.media.length) throw new ApiError('INTERNAL_ERROR')
    for (const value of section.shared.media) {
      const slot = slots.find(slot => slot.key === value.key)
      if (!slot) throw new ApiError('INTERNAL_ERROR')
      if (value.presentation && (slot.kind === 'video' || !slot.imagePreset || !imagePresentationSchema(slot.imagePreset).safeParse(value.presentation).success)) throw new ApiError('INTERNAL_ERROR')
      shared.media.push({key: value.key, ...await reference(value, slot.kind, slot.imagePreset)})
    }
    rendererPaths ??= websiteRendererPaths(tx, 'public')
    return {capabilities:policy.templates[section.templateKey]?.provides??[],id: section.id, renderer: (await rendererPaths)(section.renderer), templateKey: section.templateKey, sortOrder: section.sortOrder, anchorKey: section.anchorKey, shared, content: content as Record<string, PublicContentValue>}
  }
  const visible = snapshot.sections.filter(section => section.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  const sections: PublicPage['sections'] = []
  for (const section of visible) {
    const {id, renderer, shared, content} = await project(section)
    sections.push({id, renderer, shared, content})
  }
  const configReleaseId=preview?null:(context??await readPublishedSiteContext(tx)).configReleaseId
  const languageReleaseId=preview?null:(context??await readPublishedSiteContext(tx)).languageReleaseId
  return {key, locale, releaseId, sections, media,configReleaseId,languageReleaseId}
}
