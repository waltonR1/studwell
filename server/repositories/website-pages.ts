// 负责官网页面与区块的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and,eq,lt,sql} from 'drizzle-orm'
import {websiteResources as resources,websiteDrafts as drafts,websiteSections as sections,websiteReleases as releases,websiteNavigation as navigation} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import {withEntityIds} from '../db/allocate-entity-id'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
export const websitePageRepository={
 async deletionInventory(db:DatabaseExecutor,id:bigint){return {
  sections:await db.select({id:sections.id}).from(sections).where(eq(sections.resourceId,id)).orderBy(sections.id),
  releases:await db.select({id:releases.id}).from(releases).where(eq(releases.resourceId,id)).orderBy(releases.id),
 }},
 async purge(db:DatabaseExecutor,id:bigint){
  await db.delete(sections).where(eq(sections.resourceId,id))
  // Explicit permanent deletion detaches internal rollback links before removing the whole history.
  await db.update(releases).set({restoredFrom:null}).where(eq(releases.resourceId,id))
  await db.delete(releases).where(eq(releases.resourceId,id))
  await db.delete(drafts).where(eq(drafts.resourceId,id))
  await db.delete(resources).where(eq(resources.id,id))
 },
 async removalState(db:DatabaseExecutor,id:bigint,key:string){
  const content=await db.select({id:sections.id}).from(sections).where(eq(sections.resourceId,id)).limit(1)
  const history=await db.select({id:releases.id}).from(releases).where(eq(releases.resourceId,id)).limit(1)
  const links=await db.select({id:navigation.id}).from(navigation).where(eq(navigation.module,key)).limit(1)
  return {hasSections:content.length>0,hasHistory:history.length>0,hasNavigation:links.length>0}
 },
 async create(db:DatabaseExecutor,key:string,actor:bigint){const row=await withEntityIds(db,'website_resources',{key:`page.${key}`,type:'page' as const,createdBy:actor,updatedBy:actor});await db.insert(resources).values(row);return row.id},
 async createDraft(db:DatabaseExecutor,resourceId:bigint,content:unknown,actor:bigint){await db.insert(drafts).values({resourceId,content,updatedBy:actor})},
 async section(db:DatabaseExecutor,resourceId:bigint,id:bigint){return(await db.select().from(sections).where(and(eq(sections.resourceId,resourceId),eq(sections.id,id))))[0]},
 async settings(db:DatabaseExecutor,resourceId:bigint,version:number,content:unknown,actor:bigint){const [r]=await db.update(drafts).set({content,settingsVersion:sql`${drafts.settingsVersion}+1`,updatedBy:actor,updatedAt:new Date()}).where(and(eq(drafts.resourceId,resourceId),eq(drafts.settingsVersion,version),lt(drafts.settingsVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async insertSection(db:DatabaseExecutor,value:typeof sections.$inferInsert){const row=await withEntityIds(db,'website_sections',value);await db.insert(sections).values(row);return row},
 async place(db:DatabaseExecutor,id:bigint,version:number,value:Partial<typeof sections.$inferInsert>){const [r]=await db.update(sections).set({...value,structureVersion:sql`${sections.structureVersion}+1`}).where(and(eq(sections.id,id),eq(sections.structureVersion,version),lt(sections.structureVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async content(db:DatabaseExecutor,id:bigint,contentVersion:number,structureVersion:number,value:Partial<typeof sections.$inferInsert>){const [r]=await db.update(sections).set({...value,contentVersion:sql`${sections.contentVersion}+1`}).where(and(eq(sections.id,id),eq(sections.contentVersion,contentVersion),eq(sections.structureVersion,structureVersion),lt(sections.contentVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async replaceTemplate(db:DatabaseExecutor,id:bigint,contentVersion:number,structureVersion:number,value:Partial<typeof sections.$inferInsert>){const [r]=await db.update(sections).set({...value,contentVersion:sql`${sections.contentVersion}+1`,structureVersion:sql`${sections.structureVersion}+1`}).where(and(eq(sections.id,id),eq(sections.contentVersion,contentVersion),eq(sections.structureVersion,structureVersion),lt(sections.contentVersion,MAX_ENTITY_VERSION),lt(sections.structureVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async remove(db:DatabaseExecutor,id:bigint){await db.delete(sections).where(eq(sections.id,id))},

}
