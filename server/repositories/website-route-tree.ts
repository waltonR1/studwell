// 负责官网路由节点与公开路由的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and,eq,isNotNull} from 'drizzle-orm'
import {websiteRouteNodes as nodes,websitePublishedRoutes as published,websiteResources} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
export type PublishedRouteInsert=typeof published.$inferInsert
export const readPublishedRoutes=(db:DatabaseExecutor)=>db.select().from(published)
export const lockRouteNodes=(db:DatabaseExecutor)=>db.select().from(nodes).orderBy(nodes.id).for('update')
export async function replacePublishedRoutes(db:DatabaseExecutor,index:PublishedRouteInsert[]){
 await db.delete(published)
 if(index.length)await db.insert(published).values(index)
}
export async function lookupPublishedWebsiteRoute(db:DatabaseExecutor,path:string){
 const [row]=await db.select({path:published.path,resourceId:published.resourceId,resourceKey:websiteResources.key}).from(published)
  .innerJoin(websiteResources,eq(websiteResources.id,published.resourceId))
  .where(and(eq(published.path,path),isNotNull(websiteResources.publishedReleaseId))).limit(1)
 return row?.path===path?row:undefined
}

export const readRouteNodes=(db:DatabaseExecutor)=>db.select().from(nodes).orderBy(nodes.id)
export const insertRouteNode=(db:DatabaseExecutor,value:typeof nodes.$inferInsert)=>db.insert(nodes).values(value).$returningId()
export const updateRouteNode=(db:DatabaseExecutor,id:bigint,value:Partial<typeof nodes.$inferInsert>)=>db.update(nodes).set(value).where(eq(nodes.id,id))
export const deleteRouteNode=(db:DatabaseExecutor,id:bigint)=>db.delete(nodes).where(eq(nodes.id,id))
export const detachPublishedRouteNode=(db:DatabaseExecutor,id:bigint)=>db.update(published).set({routeNodeId:null}).where(eq(published.routeNodeId,id))
