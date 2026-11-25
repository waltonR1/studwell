// 负责官网资源与发布历史的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {contentHash} from '../db/content-hash'
import {sectionTemplateRevisionSchema} from '#shared/schemas/admin/section-template'
import {and,desc,eq,inArray,lt,sql} from 'drizzle-orm'
import {websiteResources as resources,websiteDrafts as drafts,websiteReleases as releases,websiteSections as sections,websiteTemplates as templates,websiteTemplateRevisions as revisions} from '../db/schema'
import {withEntityIds} from '../db/allocate-entity-id'
import type {DatabaseExecutor} from '../db/transaction'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
export const websiteResourceRepository={
 all:(db:DatabaseExecutor)=>db.select().from(resources).orderBy(resources.id),
 lockKeys:(db:DatabaseExecutor,keys:string[])=>keys.length ? db.select().from(resources).where(inArray(resources.key,[...new Set(keys)])).orderBy(resources.id).for('update') : Promise.resolve([]),
 async find(db:DatabaseExecutor,key:string,lock=false){const q=db.select().from(resources).where(eq(resources.key,key)).limit(1);return(await(lock?q.for('update'):q))[0]},
 async draft(db:DatabaseExecutor,id:bigint){return(await db.select().from(drafts).where(eq(drafts.resourceId,id)))[0]},
 async bump(db:DatabaseExecutor,id:bigint,actor:bigint){const [r]=await db.update(resources).set({draftVersion:sql`${resources.draftVersion}+1`,updatedBy:actor,updatedAt:new Date()}).where(and(eq(resources.id,id),lt(resources.draftVersion,MAX_ENTITY_VERSION)));return r.affectedRows===1},
 async sections(db:DatabaseExecutor,id:bigint){return (await db.select({section:sections,template:templates,revision:revisions}).from(sections).innerJoin(templates,eq(templates.id,sections.templateId)).innerJoin(revisions,and(eq(revisions.templateId,sections.templateId),eq(revisions.version,sections.templateRevision))).where(and(eq(sections.resourceId,id))).orderBy(sections.sortOrder,sections.id)).map(row=>({...row,revision:{...row.revision,definition:sectionTemplateRevisionSchema.parse(row.revision.definition)}}))},
 listReleases:(db:DatabaseExecutor,id:bigint)=>db.select().from(releases).where(eq(releases.resourceId,id)).orderBy(desc(releases.createdAt),desc(releases.id)),
 async release(db:DatabaseExecutor,id:bigint,resourceId:bigint){return(await db.select().from(releases).where(and(eq(releases.id,id),eq(releases.resourceId,resourceId))))[0]},
 async append(db:DatabaseExecutor,value:Omit<typeof releases.$inferInsert,'contentHash'>){const row=await withEntityIds(db,'website_releases',{...value,contentHash:contentHash(value.content)});await db.insert(releases).values(row);return row},
 async activate(db:DatabaseExecutor,id:bigint,releaseId:bigint){const [result]=await db.update(resources).set({publishedReleaseId:releaseId,stateVersion:sql`${resources.stateVersion}+1`}).where(and(eq(resources.id,id),lt(resources.stateVersion,MAX_ENTITY_VERSION)));return result.affectedRows===1},
 async withdraw(db:DatabaseExecutor,id:bigint,version:number){const [result]=await db.update(resources).set({publishedReleaseId:null,stateVersion:sql`${resources.stateVersion}+1`}).where(and(eq(resources.id,id),eq(resources.stateVersion,version),lt(resources.stateVersion,MAX_ENTITY_VERSION)));return result.affectedRows===1},
}
