// 负责新闻的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {contentHash} from '../db/content-hash'
import {supportedLocales} from '#shared/config/site-languages'
import {and,eq,desc,asc,sql,or,like,isNotNull,isNull,count,lt} from 'drizzle-orm'
import {newsCategories as categories,newsArticles as articles,newsReleases as releases,websiteNavigation} from '../db/schema'
import {withEntityIds} from '../db/allocate-entity-id'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import type {NewsContent,NewsCategoryInput} from '#shared/schemas/admin/news'
import type {DatabaseExecutor} from '../db/transaction'
import type {z} from 'zod'
import type {newsQuerySchema} from '#shared/schemas/admin/news'
export const newsRepository={
 lockCategories:(db:DatabaseExecutor)=>db.select().from(categories).orderBy(asc(categories.id)).for('update'),
 async categoryOrder(db:DatabaseExecutor,id:bigint,sortOrder:number,actor:bigint){const [r]=await db.update(categories).set({sortOrder,version:sql`${categories.version}+1`,updatedBy:actor,updatedAt:new Date()}).where(and(eq(categories.id,id),lt(categories.version,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async insertCategory(db:DatabaseExecutor,value:NewsCategoryInput,actor:bigint){const row=await withEntityIds(db,'news_categories',{...value,createdBy:actor,updatedBy:actor});await db.insert(categories).values(row);return row.id},
 async updateCategory(db:DatabaseExecutor,id:bigint,value:NewsCategoryInput,actor:bigint){const [r]=await db.update(categories).set({name:value.name,sortOrder:value.sortOrder,enabled:value.enabled,version:sql`${categories.version}+1`,updatedBy:actor,updatedAt:new Date()}).where(and(eq(categories.id,id),lt(categories.version,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async categoryReferences(db:DatabaseExecutor,id:bigint,code:string){
  const drafts=await db.select({id:articles.id}).from(articles).where(eq(articles.categoryId,id)).limit(1),history=await db.select({id:releases.id}).from(releases).where(eq(releases.categoryId,id)).limit(1),published=await db.select({id:articles.id}).from(articles).innerJoin(releases,eq(articles.publishedReleaseId,releases.id)).where(eq(releases.categoryId,id)).limit(1),navigation=await db.select({id:websiteNavigation.id}).from(websiteNavigation).where(and(eq(websiteNavigation.targetType,'news-category'),eq(websiteNavigation.targetValue,code))).limit(1)
  return {drafts:!!drafts.length,history:!!history.length,published:!!published.length,navigation:!!navigation.length}
 },
 deleteCategory:(db:DatabaseExecutor,id:bigint)=>db.delete(categories).where(eq(categories.id,id)),
 async insertArticle(db:DatabaseExecutor,slug:string,content:NewsContent,actor:bigint){const row=await withEntityIds(db,'news_articles',{slug,categoryId:BigInt(content.categoryId),content,createdBy:actor,updatedBy:actor});await db.insert(articles).values(row);return row.id},
 async updateArticle(db:DatabaseExecutor,id:bigint,slug:string,content:NewsContent,actor:bigint){const [r]=await db.update(articles).set({slug,categoryId:BigInt(content.categoryId),content,draftVersion:sql`${articles.draftVersion}+1`,updatedBy:actor,updatedAt:new Date()}).where(and(eq(articles.id,id),lt(articles.draftVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async append(db:DatabaseExecutor,value:Omit<typeof releases.$inferInsert,'id'|'contentHash'>){const row=await withEntityIds(db,'news_releases',{...value,contentHash:contentHash(value.content)});await db.insert(releases).values(row);return row},
 activate:(db:DatabaseExecutor,id:bigint,releaseId:bigint|null,actor:bigint)=>db.update(articles).set({publishedReleaseId:releaseId,stateVersion:sql`${articles.stateVersion}+1`,updatedBy:actor,updatedAt:new Date()}).where(eq(articles.id,id)),
 remove:(db:DatabaseExecutor,id:bigint)=>db.delete(articles).where(eq(articles.id,id)),
 categories:(db:DatabaseExecutor)=>db.select().from(categories).orderBy(asc(categories.sortOrder),asc(categories.id)),
 async category(db:DatabaseExecutor,id:bigint,lock=false){const q=db.select().from(categories).where(eq(categories.id,id));return(await(lock?q.for('update'):q))[0]},
 async article(db:DatabaseExecutor,id:bigint,lock=false){const q=db.select().from(articles).where(eq(articles.id,id));return(await(lock?q.for('update'):q))[0]},
 history:(db:DatabaseExecutor,id:bigint)=>db.select().from(releases).where(eq(releases.articleId,id)).orderBy(desc(releases.createdAt),desc(releases.id)),
 async release(db:DatabaseExecutor,id:bigint,articleId:bigint){return(await db.select().from(releases).where(and(eq(releases.id,id),eq(releases.articleId,articleId))))[0]},
 async list(db:DatabaseExecutor,q:z.infer<typeof newsQuerySchema>){
  const pattern='%'+q.search.replace(/[\\%_]/g,'\\$&')+'%'
  const search=q.search?or(like(articles.slug,pattern),...supportedLocales.map(locale=>like(sql`JSON_UNQUOTE(JSON_EXTRACT(${articles.content}, ${'$.localized.'+locale+'.title'}))`,pattern))):undefined
  const where=and(search,q.categoryId?eq(articles.categoryId,BigInt(q.categoryId)):undefined,q.status==='published'?isNotNull(articles.publishedReleaseId):q.status==='unpublished'?and(isNull(articles.publishedReleaseId),sql`NOT EXISTS (SELECT 1 FROM news_releases WHERE article_id=${articles.id})`):q.status==='offline'?and(isNull(articles.publishedReleaseId),sql`EXISTS (SELECT 1 FROM news_releases WHERE article_id=${articles.id})`):undefined)
  const [total]=await db.select({value:count()}).from(articles).where(where)
  const items=await db.select().from(articles).where(where).orderBy(desc(articles.updatedAt),desc(articles.id)).limit(q.pageSize).offset((q.page-1)*q.pageSize)
  return {items,total:total!.value,page:q.page,pageSize:q.pageSize}
 },
}
export type NewsCategoryRow=typeof categories.$inferSelect
