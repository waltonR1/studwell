// 负责招聘岗位的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and,asc,eq} from 'drizzle-orm'
import {careerPositions as positions,careerPositionReleases as releases} from '../db/schema'
import {withEntityIds} from '../db/allocate-entity-id'
import type {DatabaseExecutor} from '../db/transaction'

const current=and(eq(positions.id,releases.positionId),eq(positions.publishedReleaseId,releases.id))
export type CareerPositionRow=typeof positions.$inferSelect
const read=(db:DatabaseExecutor)=>db.select({position:positions,content:releases.content}).from(positions).leftJoin(releases,current)
export const careerRepository={
 list:(db:DatabaseExecutor)=>read(db),
 lockList:(db:DatabaseExecutor)=>db.select().from(positions).for('update'),
 get:async(db:DatabaseExecutor,id:bigint)=>(await read(db).where(eq(positions.id,id)))[0],
 lock:async(db:DatabaseExecutor,id:bigint)=>(await db.select().from(positions).where(eq(positions.id,id)).for('update'))[0],
 published:(db:DatabaseExecutor)=>db.select({id:positions.id,content:releases.content}).from(positions).innerJoin(releases,current).orderBy(asc(releases.sortOrder),asc(positions.id)),
 async insert(db:DatabaseExecutor,value:typeof positions.$inferInsert){
  const row=await withEntityIds(db,'career_positions',value)
  await db.insert(positions).values(row)
  return row.id
 },
 async append(db:DatabaseExecutor,value:typeof releases.$inferInsert){
  const row=await withEntityIds(db,'career_position_releases',value)
  await db.insert(releases).values(row)
  return row.id
 },
 update:(db:DatabaseExecutor,id:bigint,value:Partial<Pick<CareerPositionRow,'draft'|'version'|'updatedBy'|'publishedReleaseId'>>)=>db.update(positions).set(value).where(eq(positions.id,id)),
}
