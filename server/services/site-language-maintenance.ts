import {publicationMetadata} from './publication-metadata'
// 语言独立发布，只校验线上路由和 SEO，不读取或发布它们的草稿。
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {readLanguageConfig,lockLanguageConfig,languageRelease,languageReleases,saveLanguageConfig,appendLanguageRelease} from '../repositories/site-languages'
import {lockSiteConfig,readSeo} from '../repositories/website-site-config'
import {readPublishedRoutes} from '../repositories/website-route-tree'
import {validateSiteConfig} from './website-route-tree'
import {readSiteLanguages} from './site-languages'
import {siteLanguageSaveSchema,siteLanguagePublishSchema} from '#shared/schemas/admin/site-languages'
import {siteLanguagesSchema} from '#shared/schemas/site-languages'
import {requirePermission} from './access/permissions'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {auditService} from './audit'
import {auditChanges} from '../policies/audit-changes'
import {taskRepository} from '../repositories/tasks'
async function root(db:DatabaseExecutor,actor:bigint,operation:'read'|'update'|'publish'){if(!(await requirePermission(db,actor,'content.site_languages.'+operation)).isRoot)throw new ApiError('FORBIDDEN')}
async function audit(db:DatabaseExecutor,actor:bigint,meta:AuthMeta,action:string,version:number){await auditService.write(db,{...meta,actorId:actor,action,targetType:'site_settings',targetId:'1',targetName:'站点语言',result:'success',createdAt:new Date(),changeContext:auditChanges('site_settings',{}, {settingsVersion:version,settingsSection:'站点语言',settingsFields:action})})}
export async function readSiteLanguageState(db:Database,actor:bigint){return db.transaction(async tx=>{await root(tx,actor,'read');const state=await readLanguageConfig(tx);return {languages:siteLanguagesSchema.parse(state.languages),publishedLanguages:await readSiteLanguages(tx),version:state.version,publishedReleaseId:state.publishedReleaseId===null?null:String(state.publishedReleaseId),releases:await publicationMetadata(tx,await languageReleases(tx))}},{isolationLevel:'repeatable read'})}
export async function saveSiteLanguageDraft(db:Database,actor:bigint,raw:unknown,meta:AuthMeta){const input=await parseInput(siteLanguageSaveSchema,raw);await db.transaction(async tx=>{await root(tx,actor,'update');await lockSiteConfig(tx);const state=await lockLanguageConfig(tx);if(state.version!==input.version||!await saveLanguageConfig(tx,state.version,{languages:input.languages}))throw conflictError('STALE','version');await audit(tx,actor,meta,'website.languages.save',state.version)},{isolationLevel:'read committed'});return readSiteLanguageState(db,actor)}
export async function publishSiteLanguages(db:Database,actor:bigint,raw:unknown,meta:AuthMeta){const input=await parseInput(siteLanguagePublishSchema,raw);return db.transaction(async tx=>{
 await root(tx,actor,'publish');await lockSiteConfig(tx);const state=await lockLanguageConfig(tx)
 if(state.version!==input.version||input.publishedReleaseId!==(state.publishedReleaseId===null?null:String(state.publishedReleaseId)))throw conflictError('STALE','version')
 const source=input.releaseId?await languageRelease(tx,BigInt(input.releaseId)):undefined
 if(input.releaseId&&!source)throw new ApiError('NOT_FOUND')
 const languages=siteLanguagesSchema.parse(source?source.content:state.languages)
 const routes=(await readPublishedRoutes(tx)).map(row=>({...row,resourceId:String(row.resourceId),routeNodeId:row.routeNodeId===null?null:String(row.routeNodeId)}))
 await validateSiteConfig(tx,{routes,seo:await readSeo(tx)},languages)
 const release=await appendLanguageRelease(tx,actor,state.version,languages,source?.id??null)
 if(!await saveLanguageConfig(tx,state.version,{publishedReleaseId:release.id}))throw conflictError('STALE','version')
 await audit(tx,actor,meta,source?'website.languages.restore':'website.languages.publish',state.version)
 await taskRepository.requestSearchRebuild(tx)
 return {version:state.version+1,publishedReleaseId:String(release.id)}
},{isolationLevel:'read committed'})}
