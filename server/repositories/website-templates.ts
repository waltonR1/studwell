// 负责区块模板及修订的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {sectionTemplateRevisionSchema} from '#shared/schemas/admin/section-template'
import {and,desc,eq,lt,sql} from 'drizzle-orm'
import {websiteSections as sections,websiteTemplates as templates,websiteResources as resources,websiteReleases as releases,websiteTemplateRevisions as revisions} from '../db/schema'
import type {DatabaseExecutor} from '../db/transaction'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
import {withEntityIds} from '../db/allocate-entity-id'
import type {SectionTemplateRevision} from '#shared/types/admin/section-template'
export const websiteTemplateRepository={
 async insert(db:DatabaseExecutor,actor:bigint,definition:SectionTemplateRevision,description:string){
  const row=await withEntityIds(db,'website_templates',{key:definition.key,name:definition.name,description,enabledForNew:false,createdBy:actor,updatedBy:actor})
  await db.insert(templates).values(row)
  await db.insert(revisions).values({templateId:row.id,version:1,definition})
  return row.id
 },
 appendRevision:(db:DatabaseExecutor,templateId:bigint,version:number,definition:SectionTemplateRevision)=>db.insert(revisions).values({templateId,version,definition}),
 async historicalReferences(db:DatabaseExecutor,key:string){return (await db.select({id:releases.id}).from(releases).where(sql`JSON_CONTAINS(${releases.content}, ${JSON.stringify({templateKey:key})}, '$.sections')`).limit(1)).length>0},
 async find(db:DatabaseExecutor,id:bigint){return(await db.select().from(templates).where(eq(templates.id,id)).for('update'))[0]},
 async hasRevision(db:DatabaseExecutor,id:bigint){return (await db.select({version:revisions.version}).from(revisions).where(eq(revisions.templateId,id)).limit(1)).length>0},
 async latestRevisionForKey(db:DatabaseExecutor,key:string){const row=(await db.select({definition:revisions.definition}).from(templates).innerJoin(revisions,eq(revisions.templateId,templates.id)).where(eq(templates.key,key)).orderBy(desc(revisions.version)).limit(1))[0];return row?{definition:sectionTemplateRevisionSchema.parse(row.definition)}:undefined},
 async sample(db:DatabaseExecutor,key:string){return (await db.select({sample:templates.previewSample}).from(templates).where(eq(templates.key,key)).limit(1))[0]?.sample??null},
 revisions:async(db:DatabaseExecutor)=>(await db.select().from(revisions).orderBy(desc(revisions.version))).map(row=>({...row,definition:sectionTemplateRevisionSchema.parse(row.definition)})),
 list:(db:DatabaseExecutor)=>db.select().from(templates).orderBy(templates.key),
 async update(db:DatabaseExecutor,id:bigint,version:number,value:Partial<typeof templates.$inferInsert>){const [r]=await db.update(templates).set({...value,metadataVersion:sql`${templates.metadataVersion}+1`}).where(and(eq(templates.id,id),eq(templates.metadataVersion,version),lt(templates.metadataVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async hasSections(db:DatabaseExecutor,id:bigint){return(await db.select({id:sections.id}).from(sections).where(eq(sections.templateId,id)).limit(1)).length>0},
 publishedReferences(db:DatabaseExecutor,key:string){return db.select({resourceId:resources.id,resourceKey:resources.key,releaseId:releases.id}).from(resources).innerJoin(releases,and(eq(resources.publishedReleaseId,releases.id),eq(resources.id,releases.resourceId))).where(and(eq(resources.type,'page'),sql`JSON_CONTAINS(${releases.content}, ${JSON.stringify({templateKey:key})}, '$.sections')`))},
 async remove(db:DatabaseExecutor,id:bigint,version:number){const [r]=await db.delete(templates).where(and(eq(templates.id,id),eq(templates.metadataVersion,version)));return r.affectedRows===1},
}
