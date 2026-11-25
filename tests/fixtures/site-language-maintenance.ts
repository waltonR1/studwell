// 测试使用独立语言生命周期；不代理路由发布。
import {readSiteLanguageState,saveSiteLanguageDraft,publishSiteLanguages} from '../../server/services/site-language-maintenance'
import type {Database} from '../../server/db/transaction'
import type {AuthMeta} from '../../server/core/auth-context'
export function languageMaintenance(db:Database,actor:bigint,meta:AuthMeta){return {read:()=>readSiteLanguageState(db,actor),save:async(languages:unknown)=>saveSiteLanguageDraft(db,actor,{version:(await readSiteLanguageState(db,actor)).version,languages},meta),publish:async(releaseId?:string)=>{const state=await readSiteLanguageState(db,actor);return publishSiteLanguages(db,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId,...(releaseId?{releaseId}:{})},meta)}}}
