// 负责新闻运行设置的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and,eq,lt,sql} from 'drizzle-orm'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {newsOperations} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'

export const newsOperationsRepository={
 async get(db:DatabaseExecutor){
  const [row]=await db.select({
   viewCountEnabled:newsOperations.viewCountEnabled,
   version:newsOperations.version,
  }).from(newsOperations).where(eq(newsOperations.id,1))
  return row
 },
 async update(db:DatabaseExecutor,viewCountEnabled:boolean,version:number){
  const [result]=await db.update(newsOperations).set({
   viewCountEnabled,
   version:sql`${newsOperations.version}+1`,
  }).where(and(
   eq(newsOperations.id,1),
   eq(newsOperations.version,version),
   lt(newsOperations.version,MAX_ENTITY_VERSION),
  ))
  return result.affectedRows===1
 },
}
