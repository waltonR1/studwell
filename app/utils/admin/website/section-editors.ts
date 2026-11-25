import {siteLocales,type SiteLocale} from '#shared/schemas/admin/site-settings'

import type {LocalizedSections} from '~/types/admin/website-section-editors'
import {assignAt} from './section-forms'
import type {ImageReference,ImagePresentation,ImageRule} from '#shared/types/image-presentation'
import {imagePresentationSchema} from '#shared/schemas/image-presentation'
import {valueAt} from './section-forms'

export function editImagePresentation(localized:LocalizedSections,locale:SiteLocale,path:string,preset:ImageRule,presentation:ImagePresentation):LocalizedSections{
 const parsed=imagePresentationSchema(preset).parse(presentation)
 return editLocale<unknown>(localized,locale,value=>{
  const reference=valueAt(value,path) as ImageReference|undefined
  if(!reference?.mediaId)throw new Error('请先选择图片。')
  reference.presentation=parsed
 })
}

// Content is JSON. Cloning this way also accepts reactive drafts without mutating props.
export function editLocale<T>(localized:LocalizedSections,locale:SiteLocale,change:(value:T)=>void):LocalizedSections{
 const next=JSON.parse(JSON.stringify(localized)) as LocalizedSections
 change(next[locale] as T)
 return next
}

export function editBannerImage(localized:LocalizedSections,locale:SiteLocale,index:number|null,mediaKey:string,mediaId:string|null,references:{path:string;identityPath:string;imagePath:string;defaults:Record<string,unknown>}):LocalizedSections{
 if(index===null){
  const next=JSON.parse(JSON.stringify(localized)) as LocalizedSections
  const referenceDefaults=references.defaults
  for(const language of siteLocales){
   const topics=valueAt(next[language],references.path) as Array<Record<string,unknown>>
   if(!topics.some(topic=>valueAt(topic,references.identityPath)===mediaKey)){const item={...referenceDefaults};assignAt(item,references.identityPath,mediaKey);assignAt(item,references.imagePath,{mediaId:null});topics.push(item)}
  }
  const topics=valueAt(next[locale],references.path) as Array<Record<string,unknown>>
  assignAt(topics.find(topic=>valueAt(topic,references.identityPath)===mediaKey)!,references.imagePath,{mediaId})
  return next
 }
 return editLocale<unknown>(localized,locale,value=>{
  const topic=(valueAt(value,references.path) as Array<Record<string,unknown>>)[index]
  if(!topic)throw new Error('该横幅配图已移除。')
  if(valueAt(topic,references.imagePath+'.mediaId')!==mediaId)assignAt(topic,references.imagePath,{mediaId})
 })
}

export function editBannerMedia(localized:LocalizedSections,locale:SiteLocale,index:number|null,mediaKey:string,selection:{id:string;kind:'image'|'video'}|null,references:{path:string;identityPath:string;imagePath:string;defaults:Record<string,unknown>;videoPath:string}):LocalizedSections{
 const next=selection?.kind==='video'
  ? JSON.parse(JSON.stringify(localized)) as LocalizedSections
  : editBannerImage(localized,locale,index,mediaKey,selection?.id??null,references)
 assignAt(next[locale],references.videoPath,{mediaId:selection?.kind==='video'?selection.id:null})
 return next
}
