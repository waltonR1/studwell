// 负责公开新闻的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and,eq,asc,desc,count,sql} from 'drizzle-orm'
import {newsArticles as articles,newsReleases as releases,newsCategories as categories} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
const rows=(db:DatabaseExecutor)=>db.select({articleId:articles.id,slug:articles.slug,viewCount:articles.viewCount,content:releases.content,categoryCode:categories.code,categoryName:categories.name,releaseId:releases.id}).from(articles).innerJoin(releases,and(eq(articles.id,releases.articleId),eq(articles.publishedReleaseId,releases.id))).innerJoin(categories,eq(categories.id,releases.categoryId))
export type PublicNewsRow=Awaited<ReturnType<typeof rows>>[number]
export const publicNewsRepository={
 searchRows:(db:DatabaseExecutor)=>rows(db).where(eq(categories.enabled,true)).orderBy(asc(articles.id)),
 categories:(db:DatabaseExecutor)=>db.select().from(categories).where(eq(categories.enabled,true)).orderBy(asc(categories.sortOrder),asc(categories.id)),
 async list(db:DatabaseExecutor,q:{category?:string;page:number;pageSize:number},featured:boolean){
  const where=and(eq(categories.enabled,true),q.category?eq(categories.code,q.category):undefined,featured?eq(releases.featured,true):undefined)
  const [total]=await db.select({value:count()}).from(articles).innerJoin(releases,and(eq(articles.id,releases.articleId),eq(articles.publishedReleaseId,releases.id))).innerJoin(categories,eq(categories.id,releases.categoryId)).where(where)
  const items=await rows(db).where(where).orderBy(...(featured?[asc(releases.featuredOrder)]:[]),desc(releases.displayDate),desc(articles.id)).limit(q.pageSize).offset((q.page-1)*q.pageSize)
  return {total:total!.value,items}
 },
 async incrementViews(db:DatabaseExecutor,row:PublicNewsRow){
  const [result]=await db.update(articles).set({viewCount:sql`least(${articles.viewCount}+1,4294967295)`}).where(and(eq(articles.id,row.articleId),eq(articles.publishedReleaseId,row.releaseId)))
  if(!result.affectedRows)return null
  const [current]=await db.select({viewCount:articles.viewCount}).from(articles).where(eq(articles.id,row.articleId))
  return current?.viewCount??null
 },
 async detail(db:DatabaseExecutor,slug:string){return(await rows(db).where(and(eq(articles.slug,slug),eq(categories.enabled,true))).limit(1))[0]},
}
