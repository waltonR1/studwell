// 读取已发布语言上下文并解析请求语言，不修改语言草稿。
import {readLanguageConfig,languageRelease} from '../repositories/site-languages'
import {defaultSiteLanguages, type SiteLanguages, type SupportedLocale} from '#shared/config/site-languages'
import {siteLanguagesSchema} from '#shared/schemas/site-languages'
import {readSiteConfig} from '../repositories/website-site-config'
import type {DatabaseExecutor} from '../db/transaction'
import {ApiError} from '../core/errors'

export interface PublishedSiteContext {languages:SiteLanguages;configReleaseId:string|null;languageReleaseId:string|null}

// 上下文由调用方在同一事务内传递，不跨请求或跨事务缓存。
export async function readPublishedSiteContext(db:DatabaseExecutor,state?:Awaited<ReturnType<typeof readSiteConfig>>):Promise<PublishedSiteContext>{
 state??=await readSiteConfig(db)
 const config=await readLanguageConfig(db)
 const release=config.publishedReleaseId===null?undefined:await languageRelease(db,config.publishedReleaseId)
 if(config.publishedReleaseId!==null&&!release)throw new ApiError('INTERNAL_ERROR')
 return {languages:siteLanguagesSchema.parse(release?release.content:defaultSiteLanguages),configReleaseId:state.publishedReleaseId===null?null:String(state.publishedReleaseId),languageReleaseId:config.publishedReleaseId===null?null:String(config.publishedReleaseId)}

}

export async function readSiteLanguages(db:DatabaseExecutor, draft=false):Promise<SiteLanguages>{
 if(draft)return siteLanguagesSchema.parse((await readLanguageConfig(db)).languages)
 return (await readPublishedSiteContext(db)).languages
}

export function resolveSiteLocale(languages:SiteLanguages,requested?:SupportedLocale){
 const locale=requested??languages.defaultLocale
 if(!languages.enabledLocales.includes(locale))throw new ApiError('NOT_FOUND')
 return locale
}

export async function resolvePublicLocale(db:DatabaseExecutor, requested?:SupportedLocale){
 return resolveSiteLocale(await readSiteLanguages(db),requested)
}
