// 校验业务内容对指定启用语言的覆盖，不读取语言配置。
import {supportedLocales,type SupportedLocale} from '#shared/config/site-languages'
import type {NewsContent} from '#shared/schemas/admin/news'
import type {CareerContent} from '#shared/schemas/admin/careers'
import type {InquirySettings} from '#shared/schemas/admin/inquiry-settings'
import {ApiError} from '../core/errors'

const incomplete=(message:string)=>new ApiError('INVALID_INPUT',[{path:'languages',message}])
export function assertNewsLanguages(content:NewsContent,locales:readonly SupportedLocale[]){
 for(const locale of locales){const value=content.localized[locale];if(!value?.title.trim()||!value.summary.trim()||!value.body.length)throw incomplete(`请补齐新闻的 ${locale} 标题、摘要和正文。`)}
}
export function assertCareerLanguages(content:CareerContent,locales:readonly SupportedLocale[]){
 for(const locale of locales)if(!content.localized[locale]?.title.trim())throw incomplete(`请补齐岗位的 ${locale} 名称。`)
}
export function assertInquiryLanguages(settings:InquirySettings,locales:readonly SupportedLocale[]){
 for(const category of settings.categories.filter(value=>value.enabled))for(const locale of locales)if(!category.labels[locale]?.trim())throw incomplete(`请补齐咨询类型 ${category.code} 的 ${locale} 名称。`)
}

// 可选文案全空时保持可选；一旦提供文案，启用语言应同时可用。
export function assertSiteSettingLanguages(value:unknown,locales:readonly SupportedLocale[],path='content'){
 if(!value||typeof value!=='object')return
 if(Array.isArray(value)){value.forEach((item,index)=>assertSiteSettingLanguages(item,locales,`${path}.${index}`));return}
 const object=value as Record<string,unknown>
 if(object.visible===false)return
 if(Object.keys(object).some(locale=>supportedLocales.includes(locale as SupportedLocale))&&Object.values(object).every(item=>typeof item==='string')){
  if(Object.values(object).some(item=>(item as string).trim()))for(const locale of locales)if(!(object[locale] as string)?.trim())throw incomplete(`请补齐 ${path} 的 ${locale} 内容。`)
  return
 }
 for(const [key,item] of Object.entries(object))assertSiteSettingLanguages(item,locales,`${path}.${key}`)
}
