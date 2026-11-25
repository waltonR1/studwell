// 两站共用的本站安装流程；仅站点数据与素材不同，不覆盖已有站点。
import renderers from './data/renderers.json'
import modulePolicy from './data/module-policy.json'
import imageRules from './data/image-rules.json'
import {websiteModulePolicySchema} from '../../../shared/schemas/website/module-policy'
import {moduleImageRulesSchema} from '../../../shared/schemas/admin/image-rules'
import {isWebsiteRendererPath} from '../../../server/services/website-renderers'
import {MAX_MENU_DEPTH} from '../../../server/config/menus'
import {menuRepository} from '../../../server/repositories/menus'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {resolve,relative,isAbsolute,sep} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {eq,sql,isNull,and} from 'drizzle-orm'
import type {Database,DatabaseTransaction} from '../../../server/db/transaction'
import type {MediaStorage} from '../../../server/core/media-storage'
import {websiteRenderers,websiteModulePolicy,websiteImageRules,adminUsers,websiteTemplates,websiteTemplateRevisions,websiteRouteNodes,websitePageSeo,websiteSiteConfig,websiteResources} from '../../../server/db/schema'
import {withEntityIds} from '../../../server/db/allocate-entity-id'
import {createLocalMediaStorage} from '../../../server/infrastructure/media-storage'
import {createMediaService} from '../../../server/services/media'
import {mediaRepository} from '../../../server/repositories/media'
import {websiteResourceRepository as resources} from '../../../server/repositories/website-resources'
import {createWebsitePagesService} from '../../../server/services/website-pages'
import {createWebsitePublishingService} from '../../../server/services/website-publishing'
import {createSiteSettingsService} from '../../../server/services/site-settings'
import {createNewsService} from '../../../server/services/news'
import {createCareerService} from '../../../server/services/careers'
import {readSiteLanguageState,saveSiteLanguageDraft,publishSiteLanguages} from '../../../server/services/site-language-maintenance'
import {readWebsiteRouteTree,publishWebsiteRouteTree} from '../../../server/services/website-route-tree'
import {inquiryCategorySettingsSchema} from '#shared/schemas/admin/inquiry-settings'
import {readInquirySettings} from '../../../server/repositories/inquiry-settings'
import {updateInquirySettings} from '../../../server/services/inquiry-settings'
import {lockSiteConfig} from '../../../server/repositories/website-site-config'
import {newsContentSchema} from '#shared/schemas/admin/news'
import {newsCategoryCreateSchema} from '#shared/schemas/admin/news'
import {siteSettingsSchema} from '#shared/schemas/admin/site-settings'
import {careerContentSchema} from '#shared/schemas/admin/careers'
import {sectionContentSchema} from '#shared/schemas/website/section-content'
import {z} from 'zod'
import {siteLanguagesSchema} from '#shared/schemas/site-languages'
import {websitePageSettingsSchema} from '#shared/schemas/website/page-settings'
import {sectionTemplateRevisionSchema} from '#shared/schemas/admin/section-template'
import data from './data/site.json'
import templates from './data/templates.json'
import templateSampleData from './data/template-samples.json'
import type {WebsiteTemplateSample} from '../../../shared/types/admin/website-preview'

const text=z.string().min(1)
const section=z.object({templateKey:text,name:z.string(),sortOrder:z.number().int().nonnegative(),visible:z.boolean(),anchorKey:text,shared:z.unknown(),localized:z.record(z.string(),z.unknown())})
const snapshot=z.object({settings:websitePageSettingsSchema,sections:z.array(section)})
const paired=z.object({draft:z.unknown(),published:z.unknown().nullable()})
const siteSeedSchema=z.object({
 version:z.literal(1),
 languages:z.object({draft:siteLanguagesSchema,published:siteLanguagesSchema.nullable()}),
 pages:z.array(z.object({key:text,name:text,sortOrder:z.number().int().nonnegative(),visible:z.boolean(),draft:snapshot,published:snapshot.nullable()})),
 settings:z.object({basic:paired,header:paired,footer:paired}),
 routes:z.array(z.object({key:text,parent:text.nullable(),slug:z.string(),targetType:z.enum(['group','page']),page:text.nullable(),sortOrder:z.number().int().nonnegative(),enabled:z.boolean()})),
 seo:z.array(z.record(z.string(),z.unknown())),
 publishedRoutes:z.object({routes:z.array(z.object({page:text,path:text,enabled:z.boolean()})),seo:z.array(z.record(z.string(),z.unknown()))}).nullable(),
 business:z.object({inquiryCategories:z.array(inquiryCategorySettingsSchema).max(50),categories:z.array(z.object({code:text,name:z.unknown(),sortOrder:z.number().int(),enabled:z.boolean()})),news:z.array(z.object({slug:text,draft:z.unknown(),published:z.unknown().nullable()})),careers:z.array(z.object({key:text,draft:z.unknown(),published:z.unknown().nullable()}))}),
 media:z.array(z.object({key:text,file:text,name:text,originalName:text,mime:text,sha256:z.string().regex(/^[a-f0-9]{64}$/)}))
})
export const site=siteSeedSchema.parse(data)
export type SiteSeed=z.infer<typeof siteSeedSchema>

export const websiteTemplateCatalog=templates.map(definition=>sectionTemplateRevisionSchema.parse(definition))
export const templateDefinition=(key:string)=>websiteTemplateCatalog.find(template=>template.key===key)

// 固定模板演示快照；编号只在样例内部关联，不引用运行库实体。
const structure=z.looseObject({key:z.string(),resourceId:z.string(),releaseId:z.string(),sections:z.array(z.looseObject({id:z.string(),templateKey:z.string()}))})
const sampleSchema=z.looseObject({
 view:z.object({page:z.looseObject({key:z.string(),locale:z.string(),releaseId:z.string(),sections:z.array(z.looseObject({id:z.string(),shared:z.object({media:z.array(z.unknown())}),content:z.record(z.string(),z.unknown())})),media:z.record(z.string(),z.looseObject({id:z.string(),src:z.string(),kind:z.enum(['image','video']),mime:z.string()}))}),structure}),
 settings:z.looseObject({locale:z.string(),pages:z.record(z.string(),structure),languages:z.object({enabledLocales:z.array(z.string()),defaultLocale:z.string()})})
})
const manifest=z.object({version:z.literal(1),media:z.array(z.object({file:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/)})),samples:z.record(z.string(),sampleSchema)}).parse(templateSampleData)
export const templateSamples=manifest.samples as unknown as Record<string,WebsiteTemplateSample>
const publicRoot=fileURLToPath(new URL('../../../public/',import.meta.url))
async function inspectTemplateSamples(templateKeys:readonly string[]){
 if(templateKeys.length!==Object.keys(templateSamples).length||templateKeys.some(key=>!templateSamples[key]))throw Error('DB_TEMPLATE_SAMPLE_COVERAGE_INVALID')
 const sources=new Set(manifest.media.map(asset=>'/'+asset.file))
 for(const asset of manifest.media){
  const path=resolve(publicRoot,asset.file),local=relative(publicRoot,path)
  if(!local||isAbsolute(local)||local==='..'||local.startsWith('..'+sep))throw Error('DB_TEMPLATE_SAMPLE_MEDIA_PATH_INVALID')
  if(createHash('sha256').update(await readFile(path)).digest('hex')!==asset.sha256)throw Error('DB_TEMPLATE_SAMPLE_MEDIA_HASH_MISMATCH')
 }
 for(const [key,sample] of Object.entries(templateSamples)){
  const {page,structure}=sample.view
  if(page.key!==structure.key||page.releaseId!==structure.releaseId||!structure.sections.some(s=>s.templateKey===key)||page.sections.some(s=>!structure.sections.some(n=>n.id===s.id)))throw Error('DB_TEMPLATE_SAMPLE_VIEW_INVALID')
  function inspect(value:unknown):void{
   if(!value||typeof value!=='object')return
   const record=value as Record<string,unknown>
   if(typeof record.src==='string'&&!sources.has(record.src))throw Error('DB_TEMPLATE_SAMPLE_MEDIA_REFERENCE_INVALID')
   for(const item of Object.values(record))inspect(item)
  }
  inspect(sample)
  function mediaReferences(value:unknown):void{
   if(!value||typeof value!=='object')return
   const record=value as Record<string,unknown>
   if(typeof record.mediaId==='string'&&!page.media[record.mediaId])throw Error('DB_TEMPLATE_SAMPLE_MEDIA_REFERENCE_INVALID')
   for(const item of Object.values(record))mediaReferences(item)
  }
  mediaReferences(page.sections)
 }
 return {templates:Object.keys(templateSamples).length,media:manifest.media.length}
}

const initialModulePolicy=websiteModulePolicySchema.parse(modulePolicy)
const initialModuleImageRules=moduleImageRulesSchema.parse(imageRules)
const initialWebsiteRenderers=renderers.map(row=>{
    if(row.scope!=='public'&&row.scope!=='preview')throw new Error('DB_RENDERER_SCOPE_INVALID')
    if(!isWebsiteRendererPath(row.scope,row.componentPath))throw new Error('DB_RENDERER_PATH_INVALID')
    return {...row,scope:row.scope as 'public'|'preview'}
})

const initialWebsitePageMenus=site.pages.map(page=>({code:'website_'+page.key,name:page.name,sortOrder:page.sortOrder}))

async function seedWebsitePageMenus(tx:DatabaseTransaction) {
    const rows=await menuRepository.all(tx,true)
    let parent=rows.find(row=>row.code==='page_maintenance')
    if(!parent){
        await menuRepository.insert(tx,{code:'page_maintenance',name:'页面维护',iconKey:'globe',pageKey:null,parentId:null,sortOrder:50,visible:true})
        parent=(await menuRepository.byCode(tx,'page_maintenance'))!
    }
    let cursor=parent,depth=0
    const seen=new Set<bigint>()
    let valid=true
    while(cursor){
        if(seen.has(cursor.id)||++depth>=MAX_MENU_DEPTH||cursor.pageKey!==null&&cursor.pageKey!=='website_page'){valid=false;break}
        seen.add(cursor.id)
        if(cursor.parentId===null)break
        const ancestor=rows.find(row=>row.id===cursor!.parentId)
        if(!ancestor){valid=false;break}
        cursor=ancestor
    }
    for(const page of initialWebsitePageMenus){
        if(rows.some(row=>row.code===page.code))continue
        await menuRepository.insert(tx,{...page,pageKey:'website_page',iconKey:'file-text',parentId:valid?parent.id:null,visible:true})
    }
}



async function seedSiteConfiguration(db:DatabaseTransaction){
 await db.insert(websiteModulePolicy).values({id:1,policy:initialModulePolicy}).onDuplicateKeyUpdate({set:{id:sql`${websiteModulePolicy.id}`}})
 await db.insert(websiteImageRules).values({id:1,rules:initialModuleImageRules}).onDuplicateKeyUpdate({set:{id:sql`${websiteImageRules.id}`}})
 if(initialWebsiteRenderers.length)await db.insert(websiteRenderers).values(initialWebsiteRenderers).onDuplicateKeyUpdate({set:{key:sql`${websiteRenderers.key}`}})
 await seedWebsitePageMenus(db)
}

const root=new URL('../../../',import.meta.url)
const expectedKeys=[...site.pages.map(p=>'page.'+p.key),'site.basic','site.header','site.footer']
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
function required<T>(value:T|undefined):T {if(value===undefined)throw Error('DB_SITE_REFERENCE_INVALID');return value}
function assetPath(file:string){const base=fileURLToPath(new URL('public/',root)),path=resolve(base,file),local=relative(base,path);if(!local||isAbsolute(local)||local==='..'||local.startsWith('..'+sep))throw Error('DB_SITE_MEDIA_PATH_INVALID');return path}
export async function inspectSiteContent(database?:Database){
 await inspectTemplateSamples(websiteTemplateCatalog.map(template=>template.key))
 if(new Set(site.pages.map(p=>p.key)).size!==site.pages.length)throw Error('DB_SITE_PAGE_DUPLICATE')
 for(const asset of site.media)if(digest(await readFile(assetPath(asset.file)))!==asset.sha256)throw Error('DB_SITE_MEDIA_HASH_MISMATCH')
 const references=new Set([...site.media.map(m=>m.key),...site.pages.map(p=>'page:'+p.key),...site.business.categories.map(c=>'category:'+c.code)])
 function inspect(value:unknown):unknown{
  if(typeof value==='string'&&/^(media|page|category):/.test(value)){if(!references.has(value))throw Error('DB_SITE_REFERENCE_INVALID');return '2000000000000000001'}
  if(Array.isArray(value))return value.map(inspect)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,inspect(v)]))
  return value
 }
 for(const page of site.pages)for(const snapshot of [page.draft,page.published])if(snapshot)for(const section of snapshot.sections){const definition=required(websiteTemplateCatalog.find(t=>t.key===section.templateKey));for(const content of Object.values(section.localized))sectionContentSchema(definition.fields).parse(inspect(content))}
 for(const key of ['basic','header','footer'] as const)for(const value of [site.settings[key].draft,site.settings[key].published])if(value)siteSettingsSchema.shape[key].parse(inspect(value))
 for(const category of site.business.categories)newsCategoryCreateSchema.parse(category)
 for(const article of site.business.news)for(const content of [article.draft,article.published])if(content)newsContentSchema.parse(inspect(content))
 for(const position of site.business.careers)for(const content of [position.draft,position.published])if(content)careerContentSchema.parse(inspect(content))
 if(!database)return {pages:site.pages.length,status:'new'}
 const present=(await resources.all(database)).filter(r=>expectedKeys.includes(r.key))
 if(present.length===expectedKeys.length)return {pages:site.pages.length,status:'existing'}
 if(present.length||(await database.select().from(websiteRouteNodes).limit(1)).length||(await database.select().from(websiteSiteConfig))[0]?.publishedReleaseId)throw Error('DB_SITE_CONTENT_CONFLICT')
 return {pages:site.pages.length,status:'new'}
}
export async function seedWebsiteTemplates(database:Database){return database.transaction(async db=>{
 await lockSiteConfig(db)
 const actor=required((await db.select().from(adminUsers).where(eq(adminUsers.isRoot,true)))[0]);if(!actor.enabled||actor.deletedAt)throw Error('DB_TEMPLATE_ROOT_REQUIRED')
 const existing=new Set((await db.select({key:websiteTemplates.key}).from(websiteTemplates)).map(t=>t.key)),created:string[]=[]
 for(const definition of websiteTemplateCatalog){if(existing.has(definition.key))continue;const row=await withEntityIds(db,'website_templates',{key:definition.key,name:definition.name,description:'',previewSample:templateSamples[definition.key],enabledForNew:true,createdBy:actor.id,updatedBy:actor.id});await db.insert(websiteTemplates).values(row);await db.insert(websiteTemplateRevisions).values({templateId:row.id,version:1,definition});created.push(definition.key)}
 for(const definition of websiteTemplateCatalog)await db.update(websiteTemplates).set({previewSample:templateSamples[definition.key]}).where(and(eq(websiteTemplates.key,definition.key),isNull(websiteTemplates.previewSample)))
 return {created}
})}
export async function seedSiteContent(database:Database,{mediaRoot=fileURLToPath(new URL('public/',root))}={}){
 const state=await inspectSiteContent(database)
 const storage=createLocalMediaStorage(mediaRoot),written:string[]=[]
 const tracked:MediaStorage={...storage,async put(...args){const key=await storage.put(...args);written.push(key);return key}}
 try{return await database.transaction(async tx=>{
  await lockSiteConfig(tx)
  const actor=required((await tx.select().from(adminUsers).where(eq(adminUsers.isRoot,true)).for('update'))[0]);if(!actor.enabled||actor.deletedAt)throw Error('DB_SITE_ROOT_REQUIRED')
  await seedSiteConfiguration(tx)
  await seedWebsiteTemplates(tx as unknown as Database)
  if(state.status==='existing')return {created:[],skipped:expectedKeys}
  if((await resources.all(tx)).some(r=>expectedKeys.includes(r.key)))throw Error('DB_SITE_CONTENT_CONFLICT')
  if(actor.mustChangePassword)await tx.update(adminUsers).set({mustChangePassword:false}).where(eq(adminUsers.id,actor.id))
  // The offline workflow only uses query and nested transaction methods, never $client.
  const result=await install(tx as unknown as Database,tracked,actor.id)
  if(actor.mustChangePassword)await tx.update(adminUsers).set({mustChangePassword:true}).where(eq(adminUsers.id,actor.id))
  return result
 })}catch(error){for(const key of written)if(!await mediaRepository.findByStorageKey(database,key))await storage.remove(key);throw error}
}
async function install(db:Database,storage:MediaStorage,actor:bigint){
 const meta={ip:'local',userAgent:'site-content-seed',requestId:randomUUID()},ids=new Map<string,string>()
 function remap(value:unknown):unknown{
  if(typeof value==='string'&&/^(media|page|category):/.test(value))return required(ids.get(value))
  if(Array.isArray(value))return value.map(remap)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v)]))
  return value
 }
 const inquiry=await readInquirySettings(db,'update')
 if(!inquiry.settings.categories.length)await updateInquirySettings(db,actor,meta,{version:inquiry.version,settings:{...inquiry.settings,categories:site.business.inquiryCategories}},false)
 const media=createMediaService(db,storage)
 for(const asset of site.media){const bytes=await readFile(assetPath(asset.file));if(digest(bytes)!==asset.sha256)throw Error('DB_SITE_MEDIA_HASH_MISMATCH');const item=await media.upload(actor,{name:asset.name,remark:'本站初始化素材'},{bytes,filename:asset.originalName,mime:asset.mime},meta);ids.set(asset.key,item.id)}
 const pages=createWebsitePagesService(db),publishing=createWebsitePublishingService(db),settings=createSiteSettingsService(db)
 // Materialize all page identities before resolving links, without creating or publishing content.
 for(const spec of site.pages){const row=await withEntityIds(db,'website_resources',{key:'page.'+spec.key,type:'page' as const,createdBy:actor,updatedBy:actor});await db.insert(websiteResources).values(row);ids.set('page:'+spec.key,String(row.id))
  const {websiteDrafts}=await import('../../../server/db/schema');await db.insert(websiteDrafts).values({resourceId:row.id,content:spec.draft.settings,updatedBy:actor})}
 let language=await readSiteLanguageState(db,actor)
 if(!language.publishedReleaseId)await publishSiteLanguages(db,actor,{version:language.version,publishedReleaseId:null},meta)
 const news=createNewsService(db),careers=createCareerService(db)
 for(const category of site.business.categories){const item=await news.categorySave(actor,null,{...category,name:category.name},meta);ids.set('category:'+category.code,item.id)}
 for(const spec of site.business.news){let article=await news.save(actor,null,{slug:spec.slug,content:newsContentSchema.parse(remap(spec.published??spec.draft))},meta);if(spec.published)await news.publish(actor,article.id,{version:article.version,stateVersion:article.stateVersion,publishedReleaseId:article.publishedReleaseId},meta)
  if(spec.published&&!isDeepStrictEqual(spec.draft,spec.published)){article=await news.detail(actor,article.id);await news.save(actor,article.id,{version:article.version,slug:spec.slug,content:newsContentSchema.parse(remap(spec.draft))},meta)}}
 for(const spec of site.business.careers){let position=await careers.mutate(actor,meta,'create',null,{content:careerContentSchema.parse(remap(spec.published??spec.draft))});if(spec.published){position=await careers.mutate(actor,meta,'publish',position.id,{version:position.version,publishedReleaseId:position.publishedReleaseId});if(!isDeepStrictEqual(spec.draft,spec.published))await careers.mutate(actor,meta,'update',position.id,{version:position.version,content:careerContentSchema.parse(remap(spec.draft))})}}
 type Snapshot=SiteSeed['pages'][number]['draft']
 function temporaryLinks(value:unknown):unknown{
  if(Array.isArray(value))return value.map(temporaryLinks)
  if(value&&typeof value==='object'){const object=value as Record<string,unknown>;if(typeof object.type==='string'&&object.type!=='custom'&&typeof object.resourceId==='string')return {type:'custom',value:'/'};return Object.fromEntries(Object.entries(object).map(([k,v])=>[k,temporaryLinks(v)]))}
  return value
 }
 async function writePage(key:string,snapshot:Snapshot,bootstrap=false){let page=await pages.read(actor,key)
  const old=page.sections,byAnchor=new Map(old.map(s=>[s.anchorKey,s]));const entries=snapshot.sections.map(section=>{const existing=byAnchor.get(section.anchorKey);if(existing&&existing.templateKey!==section.templateKey)throw Error('DB_SITE_TEMPLATE_CHANGED_AT_ANCHOR');const template=required(page.templates.find(t=>t.key===section.templateKey));return {id:existing?.id??'new_'+section.anchorKey,templateId:template.id,templateKey:section.templateKey,name:section.name,sortOrder:section.sortOrder,visible:section.visible,anchorKey:section.anchorKey,contentVersion:existing?.contentVersion??1,structureVersion:existing?.structureVersion??1}})
  page=await pages.settings(actor,key,{version:page.settingsVersion,settings:snapshot.settings,removed:old.filter(s=>!snapshot.sections.some(n=>n.anchorKey===s.anchorKey)).map(s=>({id:s.id,contentVersion:s.contentVersion})),sections:entries},meta)
  for(const spec of snapshot.sections){const section=required(page.sections.find(s=>s.anchorKey===spec.anchorKey)),definition=required(websiteTemplateCatalog.find(t=>t.key===spec.templateKey));
const localized=Object.fromEntries(Object.entries(spec.localized).map(([locale,value])=>[locale,sectionContentSchema(definition.fields).parse(remap(bootstrap?temporaryLinks(value):value))]));await pages.section(actor,key,section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,name:spec.name,shared:remap(spec.shared),localized},meta)}
 }
 for(const spec of site.pages)await writePage(spec.key,spec.published??spec.draft,!!spec.published)
 async function publish(key:string){const page=required(await resources.find(db,key));await publishing.publish(actor,key,{version:page.draftVersion,stateVersion:page.stateVersion,publishedReleaseId:page.publishedReleaseId?String(page.publishedReleaseId):null},meta)}
 const pending=site.pages.filter(p=>p.published).map(p=>p.key)
 while(pending.length){let progressed=false;const errors:Array<{page:string;error:unknown}>=[];for(const key of [...pending]){try{await publish('page.'+key);pending.splice(pending.indexOf(key),1);progressed=true}catch(error){errors.push({page:key,error})}}if(!progressed){console.error(errors.map(e=>({page:e.page,code:(e.error as {code?:string}).code,fields:(e.error as {fields?:unknown}).fields})));throw required(errors[0]).error}}
 // All site paths are already declared. Preserve draft enablement after publishing its online state.
 const nodes=new Map<string,bigint>(),remaining=[...site.routes]
 while(remaining.length){let progressed=false;for(const node of [...remaining]){if(node.parent&&!nodes.has(node.parent))continue
  const published=node.page?site.publishedRoutes?.routes.find(r=>r.page===node.page):null
  const result=await db.insert(websiteRouteNodes).values({parentId:node.parent?required(nodes.get(node.parent)):null,slug:node.slug,targetType:node.targetType,resourceId:node.page?BigInt(required(ids.get('page:'+node.page))):null,sortOrder:node.sortOrder,enabled:!!published&&published.enabled})
  nodes.set(node.key,BigInt(result[0].insertId));remaining.splice(remaining.indexOf(node),1);progressed=true}if(!progressed)throw Error('DB_SITE_ROUTE_CYCLE')}
 const seoRows=(rows:SiteSeed['seo'])=>rows.map(row=>{const value=remap(row) as Record<string,unknown>;return {resourceId:BigInt(String(value.resourceId)),locale:String(value.locale) as 'zh'|'en'|'fr'|'es'|'pt',title:String(value.title),description:String(value.description),indexable:!!value.indexable,ogTitle:String(value.ogTitle),ogDescription:String(value.ogDescription),ogMediaId:value.ogMediaId?BigInt(String(value.ogMediaId)):null}})
 const onlineSeo=seoRows(site.publishedRoutes?.seo??site.seo)
 if(onlineSeo.length)await db.insert(websitePageSeo).values(onlineSeo)
 if(site.publishedRoutes){const state=await readWebsiteRouteTree(db,actor);await publishWebsiteRouteTree(db,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId},meta)}
 for(const spec of site.pages)if(spec.published){await writePage(spec.key,spec.published);await publish('page.'+spec.key)}
 for(const key of ['basic','header','footer'] as const){const spec=site.settings[key],state=await settings.read(actor);await settings.update(actor,{section:key,version:state.versions[key],content:remap(spec.published??spec.draft)},meta);if(spec.published)await publish('site.'+key)}
 if(site.languages.published){language=await readSiteLanguageState(db,actor);await saveSiteLanguageDraft(db,actor,{version:language.version,languages:site.languages.published},meta);language=await readSiteLanguageState(db,actor);await publishSiteLanguages(db,actor,{version:language.version,publishedReleaseId:language.publishedReleaseId},meta)}
 // Restore unpublished work without changing its public version.
 for(const spec of site.pages)if(spec.published&&!isDeepStrictEqual(spec.draft,spec.published))await writePage(spec.key,spec.draft)
 for(const key of ['basic','header','footer'] as const){const spec=site.settings[key];if(spec.published&&!isDeepStrictEqual(spec.draft,spec.published)){const state=await settings.read(actor);await settings.update(actor,{section:key,version:state.versions[key],content:remap(spec.draft)},meta)}}
 for(const node of site.routes)await db.update(websiteRouteNodes).set({enabled:node.enabled}).where(eq(websiteRouteNodes.id,required(nodes.get(node.key))))
 await db.delete(websitePageSeo);const draftSeo=seoRows(site.seo);if(draftSeo.length)await db.insert(websitePageSeo).values(draftSeo)
 for(const row of draftSeo)await mediaRepository.replaceReferences(db,'website:seo:'+String(row.resourceId),draftSeo.filter(s=>s.resourceId===row.resourceId&&s.ogMediaId).map(s=>({field:s.locale,mediaId:s.ogMediaId!})))
 if(!isDeepStrictEqual(site.languages.draft,site.languages.published)){language=await readSiteLanguageState(db,actor);await saveSiteLanguageDraft(db,actor,{version:language.version,languages:site.languages.draft},meta)}
 for(const spec of site.pages)if(!spec.visible){const {adminMenus}=await import('../../../server/db/schema');await db.update(adminMenus).set({visible:false}).where(eq(adminMenus.code,'website_'+spec.key))}
 return {created:expectedKeys,skipped:[]}
}
