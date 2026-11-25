// 校验页面设置、区块排序及发布内容完整性，并构造区块快照。
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {sectionContentSchema} from '#shared/schemas/website/section-content'

import type {SectionField} from '#shared/types/website/section-template'
import {siteLocaleNames} from '#shared/config/admin/site-settings'
import {siteLocales} from '#shared/schemas/admin/site-settings'
import {parseInput} from '../core/validation'
import {ApiError} from '../core/errors'
import {hasBannerVideo} from './website-banner'
import {publishedPageSnapshotSchema,publishedFieldDefinition} from './public-website-snapshot'
const invalid=(message:string)=>new ApiError('INVALID_INPUT',[{path:'content',message}])
type Section={templateKey:string;visible:boolean;sortOrder:number;localized:Record<string,unknown>;shared:unknown}
export function snapshotSections(content:unknown):Section[]{return (content as {sections?:Section[]})?.sections??[]}
export function validateSettings(_pageKey:string,settings:ReturnType<typeof websitePageSettingsSchema.parse>){if(settings.sceneEnabled!== (settings.sceneTransitionSeconds!==null))throw invalid('启用场景切换时必须填写切换时长。')}
export function validateSectionOrdering(sections:Array<{sortOrder:number}>){if([...sections].sort((a,b)=>a.sortOrder-b.sortOrder).some((section,index)=>section.sortOrder!==index))throw invalid('区块顺序必须从 0 连续递增。')}
function required(f:SectionField,v:unknown,videoHero=false):boolean{
 if(f.optional&&(v===undefined||f.kind==='media'&&!(v as {mediaId?:string|null})?.mediaId))return true
 if(f.kind==='tree')return Object.entries(f.fields).every(([key,child])=>required(child,(v as Record<string,unknown>)?.[key],videoHero))&&(!(v as {children?:unknown})?.children||Array.isArray((v as {children:unknown}).children)&&((v as {children:unknown[]}).children).every(child=>required(f,child,videoHero)))
 if(f.kind==='group')return Object.entries(f.fields).every(([key,child])=>required(child,(v as Record<string,unknown>)?.[key],videoHero))
 if(f.kind==='list')return Array.isArray(v)&&v.every(item=>required(f.item,item,videoHero))
 if(f.kind==='link')return !f.required||v!==null&&v!==undefined&&v!==''
 if(f.kind==='media')return videoHero&&f.mediaKind!=='video'||!!(v as {mediaId?:string|null})?.mediaId
 return f.kind!=='text'||!f.required||typeof v==='string'&&!!v.trim()
}
export const isSectionContentComplete=required
// 语言配置发布校验已发布合同，不用当前字段定义重写历史快照的语义。
export async function validatePublishedPageLanguages(raw:unknown,locales:readonly typeof siteLocales[number][]){
 const snapshot=publishedPageSnapshotSchema.parse(raw)
 for(const section of snapshot.sections.filter(value=>value.visible)){
  const fields=publishedFieldDefinition(section.definition)
  for(const locale of locales){
   const content=await parseInput(sectionContentSchema(fields),section.localized[locale])
   if(!required(fields,content,hasBannerVideo(section.videoPath ?? undefined,content)))throw invalid(`请补齐已发布区块 ${section.templateKey} 的 ${siteLocaleNames[locale]} 内容。`)
  }
 }
}
export async function validatePagePublication(
 pageKey: string,
 raw: unknown,
 locales: readonly typeof siteLocales[number][] = siteLocales,
) {
 const parsed = publishedPageSnapshotSchema.safeParse(raw)
 if (!parsed.success) throw invalid('页面快照结构无效。')
 const {settings, sections} = parsed.data
 validateSettings(pageKey,settings)
 validateSectionOrdering(sections)
 const effective = sections.filter(section => section.visible)
 if (!effective.length) throw invalid('至少需要一个有效显示的 Section。')

 for (const section of sections) {
  if (section.allowedPages !== 'all' && !section.allowedPages.includes(pageKey)) {
   throw invalid('模板定义不可用，无法发布或回滚。')
  }
  const fields = publishedFieldDefinition(section.definition)
  for (const locale of locales) {
   const content = await parseInput(sectionContentSchema(fields),section.localized[locale])
   if (!section.visible) continue
   if (!required(fields,content,hasBannerVideo(section.videoPath ?? undefined,content))) {
    throw invalid(`${section.name}的 ${siteLocaleNames[locale]} 必填内容未完整填写。`)
   }
  }
 }

 return parsed.data
}
