import {publicationMetadata} from './publication-metadata'
// 协调新闻业务规则、权限及持久化调用，不直接处理 HTTP 或 ORM。
import {readModuleImageRules} from '../repositories/website-image-rules'
import {imagePresentationSchema} from '#shared/schemas/image-presentation'
import {snapshotHasCapability} from './website-capabilities'
import {lockSiteConfig} from '../repositories/website-site-config'
import {readSiteLanguages} from './site-languages'
import {adminContentLocale,supportedLocales,type SupportedLocale} from '#shared/config/site-languages'
import {publishedNewsPages} from './website-navigation-references'
import {taskRepository} from '../repositories/tasks'
import {isDeepStrictEqual} from 'node:util'
import type {Database,DatabaseExecutor} from '../db/transaction'
import type {AuthMeta} from '../core/auth-context'
import {newsRepository as repo,type NewsCategoryRow} from '../repositories/news'
import {websiteResourceRepository as website} from '../repositories/website-resources'
import {mediaRepository} from '../repositories/media'
import {requirePermission} from './access/permissions'
import {auditedWrite} from './operations/audited-write'
import {readNewsOperations,saveNewsOperations} from './news-operations'
import {createWebsitePublishingService} from './website-publishing'
import {createWebsitePageWithdrawalService} from './website-page-withdrawal'
import {resourcePublication} from './website-read-model'
import {auditChanges} from '../policies/audit-changes'
import {publishedNavigationLinks} from '../policies/website-navigation'
import {parseInput} from '../core/validation'
import {ApiError,conflictError} from '../core/errors'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {newsCategoryCreateSchema,newsCategoryUpdateSchema,newsCategoryMoveSchema,newsArticleCreateSchema,newsArticleUpdateSchema,newsPublicationInputSchema,newsRestoreSchema,newsVersionSchema,newsQuerySchema,newsContentSchema,type NewsContent} from '#shared/schemas/admin/news'
import type {NewsArticle,NewsCategory} from '#shared/types/admin/news'
type Article=NonNullable<Awaited<ReturnType<typeof repo.article>>>
async function newsLifecyclePage(db:DatabaseExecutor){
 const online=await publishedNewsPages(db)
 if(online.length===1)return online[0]
 if(online.length>1)throw new ApiError('INVALID_INPUT',[{path:'page',message:'有多个新闻页面，请在对应网页维护中操作。'}])
 const candidates=[]
 for(const page of await website.all(db)){
  if(page.type!=='page')continue
  const sections=await website.sections(db,page.id)
  if(await snapshotHasCapability(db,{sections:sections.map(({section,template})=>({visible:section.visible,templateKey:template.key}))},'news.list')||
   (await Promise.all((await website.listReleases(db,page.id)).map(release=>snapshotHasCapability(db,release.content,'news.list')))).some(Boolean))candidates.push(page)
 }
 if(candidates.length>1)throw new ApiError('INVALID_INPUT',[{path:'page',message:'有多个新闻页面，请在对应网页维护中操作。'}])
 return candidates[0]
}
type PageLifecycleInput={version:number;stateVersion:number;publishedReleaseId:string|null;releaseId?:string}
const invalid=(message:string)=>new ApiError('INVALID_INPUT',[{path:'content',message}])
const categoryDto=(c:NewsCategoryRow):NewsCategory=>({id:String(c.id),code:c.code,name:c.name,sortOrder:c.sortOrder,enabled:c.enabled,version:c.version})
export function newsMedia(content:NewsContent){
 const result:Array<{field:string;mediaId:bigint}>=[]
 if(content.coverMediaId)result.push({field:'cover',mediaId:BigInt(content.coverMediaId)})
 for(const [locale,t] of Object.entries(content.localized))t.body.forEach((b,i)=>{if(b.type==='image')result.push({field:`${locale}.body.${i}`,mediaId:BigInt(b.image.mediaId)})})
 return result
}
async function syncMedia(db:DatabaseExecutor,owner:string,content:NewsContent){
 const rules=await readModuleImageRules(db)
 await parseInput(imagePresentationSchema(rules.newsCover).optional(),content.coverPresentation)
 for(const translation of Object.values(content.localized))for(const block of translation.body)if(block.type==='image')await parseInput(imagePresentationSchema(rules.newsBody).optional(),block.image.presentation)
 const refs=newsMedia(content)
 for(const ref of refs)if((await mediaRepository.find(db,ref.mediaId))?.kind!=='image')throw invalid('请选择有效的媒体库图片。')
 try{await mediaRepository.replaceReferences(db,owner,refs)}catch(error){if(error instanceof Error&&error.message==='MEDIA_REFERENCE_NOT_FOUND')throw invalid('选中的图片已不存在。');throw error}
}
export function validateNewsPublication(content:NewsContent,locales:readonly SupportedLocale[]=supportedLocales){
 newsContentSchema.parse(content)
 for(const locale of locales){const t=content.localized[locale];if(!t?.title||!t.summary||!t.body.length)throw invalid('请完成启用语言的标题、摘要和正文后发布。')}
}
async function dto(db:DatabaseExecutor,a:Article):Promise<NewsArticle>{
 const history=await repo.history(db,a.id),current=history.find(r=>r.id===a.publishedReleaseId)
 const metadata=await publicationMetadata(db,history)
 return {id:String(a.id),slug:a.slug,viewCount:a.viewCount,content:a.content,version:a.draftVersion,stateVersion:a.stateVersion,publishedReleaseId:a.publishedReleaseId?String(a.publishedReleaseId):null,status:a.publishedReleaseId?'published':history.length?'offline':'unpublished',changed:!current||!isDeepStrictEqual(a.content,current.content),updatedAt:a.updatedAt.toISOString(),releases:metadata.map((row,index)=>({...row,draftVersion:history[index]!.draftVersion}))}
}
async function activeCategory(db:DatabaseExecutor,id:string){const c=await repo.category(db,BigInt(id),true);if(!c?.enabled)throw invalid('请选择已启用的新闻分类。');return c}
export function createNewsService(db:Database){
 const read=(actor:bigint)=>requirePermission(db,actor,'content.news.read')
 const write=<T>(actor:bigint,meta:AuthMeta,action:string,id:string|null,work:Parameters<typeof auditedWrite<T>>[2])=>auditedWrite(db,{actor,meta,action,id,targetType:'news',isolationLevel:'read committed'},work)
 const result=<T>(id:bigint,name:string,value:T,version:number,fields:string)=>({id,name,value,changes:auditChanges('news',{}, {name,settingsVersion:version,settingsFields:fields})})
 return {
  async categories(actor:bigint){await read(actor);return(await repo.categories(db)).map(categoryDto)},
  async overview(actor:bigint){await read(actor);return db.transaction(async tx=>{
   const page=await newsLifecyclePage(tx)
   return page?resourcePublication(tx,page):null
  },{isolationLevel:'repeatable read'})},
  async operations(actor:bigint){await read(actor);return readNewsOperations(db)},
  async saveOperations(actor:bigint,raw:unknown,meta:AuthMeta){return saveNewsOperations(db,actor,raw,meta)},
  async reopen(actor:bigint,input:PageLifecycleInput,meta:AuthMeta){
   await requirePermission(db,actor,'content.news.publish')
   const page=await newsLifecyclePage(db);if(!page)throw new ApiError('NOT_FOUND')
   const publishing=createWebsitePublishingService(db)
   return input.releaseId
    ?publishing.restore(actor,page.key,input,meta)
    :publishing.publish(actor,page.key,{version:input.version,stateVersion:input.stateVersion,publishedReleaseId:null},meta)
  },
  async withdrawAll(actor:bigint,input:PageLifecycleInput,meta:AuthMeta){
   await requirePermission(db,actor,'content.news.publish')
   const page=await newsLifecyclePage(db);if(!page)throw new ApiError('NOT_FOUND')
   return createWebsitePageWithdrawalService(db).withdraw(actor,page.key,input,meta)
  },
  async categoryMove(actor:bigint,id:string,raw:unknown,meta:AuthMeta){const input=await parseInput(newsCategoryMoveSchema,raw);return write(actor,meta,'news.category.move',id,async tx=>{
   await requirePermission(tx,actor,'content.news.categories.update');await website.lockKeys(tx,(await publishedNewsPages(tx)).map(page=>page.key))
   const rows=(await repo.lockCategories(tx)).sort((a,b)=>a.sortOrder-b.sortOrder||(a.id<b.id?-1:a.id>b.id?1:0))
   const index=rows.findIndex(c=>String(c.id)===id),current=rows[index],neighborIndex=index+(input.direction==='up'?-1:1),neighbor=rows[neighborIndex]
   if(!current)throw new ApiError('NOT_FOUND')
   if(current.version!==input.version||!neighbor||String(neighbor.id)!==input.neighborId||neighbor.version!==input.neighborVersion)throw conflictError('STALE','version')
   const changes=current.sortOrder===neighbor.sortOrder?(()=>{const ordered=[...rows];[ordered[index],ordered[neighborIndex]]=[neighbor,current];return ordered.map((c,i)=>({category:c,order:i})).filter(c=>c.category.sortOrder!==c.order)})():[{category:current,order:neighbor.sortOrder},{category:neighbor,order:current.sortOrder}]
   for(const change of changes)if(!await repo.categoryOrder(tx,change.category.id,change.order,actor))throw conflictError('STALE','version')
   return result(current.id,current.name[adminContentLocale]??current.code,(await repo.categories(tx)).map(categoryDto),current.version+1,'调整分类顺序')
  })},
  async categorySave(actor:bigint,id:string|null,raw:unknown,meta:AuthMeta){
   const input=await parseInput(id?newsCategoryUpdateSchema:newsCategoryCreateSchema,raw)
   return write(actor,meta,id?'news.category.update':'news.category.create',id,async tx=>{
    await requirePermission(tx,actor,'content.news.categories.update')
    await lockSiteConfig(tx)
    if(input.enabled&&(await readSiteLanguages(tx)).enabledLocales.some(locale=>!input.name[locale]?.trim()))throw invalid('请补齐启用语言的新闻分类名称。')
    await website.lockKeys(tx,(await publishedNewsPages(tx)).map(page=>page.key))
    const old=id?await repo.category(tx,BigInt(id),true):undefined
    if(id&&!old)throw new ApiError('NOT_FOUND')
    if(old&&(!('version' in input)||old.version!==input.version))throw conflictError('STALE','version')
    if(old&&old.code!==input.code)throw invalid('分类编码创建后不可修改。')
    if(old&&!input.enabled){
     const linked=await repo.categoryReferences(tx,old.id,old.code)
     if(linked.published)throw invalid('仍有已发布文章属于此分类，请先调整或下线文章。')
     for(const r of (await website.all(tx)).filter(r=>(r.type==='header'||r.type==='footer'||r.type==='page')&&r.publishedReleaseId)){
      const release=await website.release(tx,r.publishedReleaseId!,r.id)
      if(publishedNavigationLinks(release?.content).some(l=>l.target.type==='news-category'&&l.target.value===old.code))throw invalid('已发布导航仍引用此分类，请先调整并发布导航。')
     }
    }
    let categoryId:bigint
    if(old){if(!await repo.updateCategory(tx,old.id,input,actor))throw conflictError('STALE','version');categoryId=old.id}
    else{const {version:_version,...value}=input as typeof input & {version?:number};categoryId=await repo.insertCategory(tx,value,actor)}
    if(old)await taskRepository.requestSearchRebuild(tx)
    const next=(await repo.category(tx,categoryId))!
    return result(next.id,next.name[adminContentLocale]??next.code,categoryDto(next),next.version,'分类资料')
   })
  },
  async categoryDelete(actor:bigint,id:string,raw:unknown,meta:AuthMeta){const input=await parseInput(newsVersionSchema,raw);return write(actor,meta,'news.category.delete',id,async tx=>{
   await requirePermission(tx,actor,'content.news.categories.update');await website.lockKeys(tx,(await publishedNewsPages(tx)).map(page=>page.key));const c=await repo.category(tx,BigInt(id),true);if(!c)throw new ApiError('NOT_FOUND');if(c.version!==input.version)throw conflictError('STALE','version')
   const refs=await repo.categoryReferences(tx,c.id,c.code)
   if(refs.drafts||refs.history||refs.navigation)throw invalid('分类已被文章或发布历史引用，不能删除。')
   // Disabled categories cannot be introduced into a published navigation.
   for(const r of (await website.all(tx)).filter(r=>(r.type==='header'||r.type==='footer'||r.type==='page')&&r.publishedReleaseId)){const release=await website.release(tx,r.publishedReleaseId!,r.id);if(publishedNavigationLinks(release?.content).some(l=>l.target.type==='news-category'&&l.target.value===c.code))throw invalid('已发布导航仍引用此分类。')}
   await repo.deleteCategory(tx,c.id);return result(c.id,c.name[adminContentLocale]??c.code,{deleted:true},c.version,'删除分类')
  })},
  async list(actor:bigint,raw:unknown){await read(actor);const q=await parseInput(newsQuerySchema,raw);return db.transaction(async tx=>{const page=await repo.list(tx,q);return {...page,items:await Promise.all(page.items.map(a=>dto(tx,a)))}},{isolationLevel:'repeatable read'})},
  async detail(actor:bigint,id:string){await read(actor);return db.transaction(async tx=>{const a=await repo.article(tx,BigInt(id));if(!a)throw new ApiError('NOT_FOUND');return dto(tx,a)},{isolationLevel:'repeatable read'})},
  async save(actor:bigint,id:string|null,raw:unknown,meta:AuthMeta){const input=await parseInput(id?newsArticleUpdateSchema:newsArticleCreateSchema,raw);return write(actor,meta,id?'news.article.update':'news.article.create',id,async tx=>{
   await requirePermission(tx,actor,'content.news.update');await activeCategory(tx,input.content.categoryId)
   const old=id?await repo.article(tx,BigInt(id),true):undefined
   if(id&&!old)throw new ApiError('NOT_FOUND')
   if(old&&(!('version' in input)||old.draftVersion!==input.version))throw conflictError('STALE','version')
   if(old&&old.slug!==input.slug&&(await repo.history(tx,old.id)).length)throw invalid('文章发布后不可修改链接标识。')
   let articleId:bigint
   if(old){if(!await repo.updateArticle(tx,old.id,input.slug,input.content,actor))throw conflictError('STALE','version');articleId=old.id}
   else{articleId=await repo.insertArticle(tx,input.slug,input.content,actor)}
   await syncMedia(tx,`news:draft:${articleId}`,input.content)
   const next=(await repo.article(tx,articleId))!;return result(next.id,next.content.localized[adminContentLocale]?.title||next.slug,await dto(tx,next),next.draftVersion,'文章草稿')
  })},
  async publish(actor:bigint,id:string,raw:unknown,meta:AuthMeta,restore=false){const input=await parseInput(restore?newsRestoreSchema:newsPublicationInputSchema,raw);return write(actor,meta,restore?'news.article.restore':'news.article.publish',id,async tx=>{
   await requirePermission(tx,actor,'content.news.publish');await lockSiteConfig(tx);const initial=await repo.article(tx,BigInt(id));if(!initial)throw new ApiError('NOT_FOUND')
   const source='releaseId' in input?await repo.release(tx,BigInt(String(input.releaseId)),initial.id):undefined;if(restore&&!source)throw new ApiError('NOT_FOUND')
   const content=source?.content??initial.content;await activeCategory(tx,content.categoryId)
   const a=await repo.article(tx,initial.id,true);if(!a)throw new ApiError('NOT_FOUND')
   if(a.draftVersion!==input.version||a.stateVersion!==input.stateVersion||(a.publishedReleaseId?String(a.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','version')
   if(a.stateVersion>=MAX_ENTITY_VERSION)throw conflictError('STALE','version')
   validateNewsPublication(content,(await readSiteLanguages(tx)).enabledLocales)
   const row=await repo.append(tx,{articleId:a.id,categoryId:BigInt(content.categoryId),content,draftVersion:source?.draftVersion??a.draftVersion,displayDate:content.displayDate,featured:content.featured,featuredOrder:content.featuredOrder,restoredFrom:source?.id??null,createdBy:actor})
   await syncMedia(tx,`news:release:${row.id}`,content)
   await repo.activate(tx,a.id,row.id,actor)
   await taskRepository.requestSearchRebuild(tx)
   const next=(await repo.article(tx,a.id))!;return result(a.id,content.localized[adminContentLocale]?.title??a.slug,await dto(tx,next),next.draftVersion,restore?'恢复历史版本':'发布文章')
  })},
  async withdraw(actor:bigint,id:string,raw:unknown,meta:AuthMeta){const input=await parseInput(newsPublicationInputSchema,raw);return write(actor,meta,'news.article.withdraw',id,async tx=>{
   await requirePermission(tx,actor,'content.news.publish');const a=await repo.article(tx,BigInt(id),true);if(!a)throw new ApiError('NOT_FOUND')
   if(a.draftVersion!==input.version||a.stateVersion!==input.stateVersion||(a.publishedReleaseId?String(a.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','version')
   if(!a.publishedReleaseId)throw invalid('文章尚未发布或已下线。');if(a.stateVersion>=MAX_ENTITY_VERSION)throw conflictError('STALE','version')
   await repo.activate(tx,a.id,null,actor);await taskRepository.requestSearchRebuild(tx);return result(a.id,a.content.localized[adminContentLocale]?.title??a.slug,await dto(tx,(await repo.article(tx,a.id))!),a.draftVersion,'下线文章')
  })},
  async remove(actor:bigint,id:string,raw:unknown,meta:AuthMeta){const input=await parseInput(newsPublicationInputSchema,raw);return write(actor,meta,'news.article.delete',id,async tx=>{
   await requirePermission(tx,actor,'content.news.delete');const a=await repo.article(tx,BigInt(id),true);if(!a)throw new ApiError('NOT_FOUND')
   if(a.draftVersion!==input.version||a.stateVersion!==input.stateVersion||(a.publishedReleaseId?String(a.publishedReleaseId):null)!==input.publishedReleaseId)throw conflictError('STALE','version')
   if((await repo.history(tx,a.id)).length)throw invalid('已有发布历史的文章不能永久删除，可执行下线。')
   await mediaRepository.removeReferencesForOwners(tx,[`news:draft:${a.id}`]);await repo.remove(tx,a.id);return result(a.id,a.slug,{deleted:true},a.draftVersion,'删除草稿')
  })},
  async release(actor:bigint,id:string,releaseId:string){await read(actor);return db.transaction(async tx=>{const a=await repo.article(tx,BigInt(id)),r=await repo.release(tx,BigInt(releaseId),BigInt(id));if(!a||!r)throw new ApiError('NOT_FOUND');return {...(await publicationMetadata(tx,[r]))[0]!,draftVersion:r.draftVersion,content:r.content,isCurrent:r.id===a.publishedReleaseId}},{isolationLevel:'repeatable read'})},
 }
}
