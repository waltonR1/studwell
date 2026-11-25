// 负责站点基础设置的数据库查询与持久化，使用调用方传入的执行器，不决定 HTTP 响应或业务授权。
import {and, asc, eq, inArray, lt, sql} from 'drizzle-orm'
import {websiteResources as resources, websiteDrafts as drafts, websiteNavigation as nodes} from '../db/schema'
import {withEntityIds} from '../db/allocate-entity-id'
import type {DatabaseExecutor} from '../db/transaction'
import {siteLinkSchema,siteSections, type SiteSection, type SiteSettings, type SiteSettingsUpdate, type SiteLink, type SiteLocale} from '#shared/schemas/admin/site-settings'
import {createSiteSettings} from '#shared/utils/admin/site-settings'
import {MAX_ENTITY_VERSION} from '#shared/config/entity-versions'
const keys=siteSections.map(section=>`site.${section}`)
export async function writeSiteNavigation(db:DatabaseExecutor,resourceId:bigint,content:SiteSettings['header']|SiteSettings['footer']) {
 const previous=await db.select().from(nodes).where(eq(nodes.resourceId,resourceId)).orderBy(asc(nodes.sortOrder)),kept:bigint[]=[]
 async function node(code:string,kind:'group'|'link',parentId:bigint|null,sortOrder:number,visible:boolean,labels:Record<SiteLocale,string>,link?:SiteLink) {
  const old=previous.find(row=>row.code===code && row.parentId===parentId && row.kind===kind)
  const target=link?.target
  const fields={visible,sortOrder,labels,targetResourceId:target&&('resourceId' in target)?BigInt(target.resourceId):null,module:target && ('resourceId' in target)?target.module:'',targetType:target?.type??'page',targetValue:target?.value??''}
  let id:bigint
  if(old){id=old.id;await db.update(nodes).set(fields).where(eq(nodes.id,id))}
  else {const row=await withEntityIds(db,'website_navigation',{resourceId,kind,parentId,code,...fields});await db.insert(nodes).values(row);id=row.id}
  kept.push(id);return id
 }
 if('items' in content){for(const [i,item] of content.items.entries()){const id=await node(item.id,'link',null,i,item.visible,item.label,item);for(const [j,child] of item.children.entries())await node(child.id,'link',id,j,child.visible,child.label,child)}}
 else {
  for(const [i,group] of content.groups.entries()){const id=await node(group.id,'group',null,i,group.visible,group.title);for(const [j,item] of group.items.entries())await node(item.id,'link',id,j,item.visible,item.label,item)}
  if(content.contactTarget)await node('contact_heading','link',null,0,true,content.contactTitle,{id:'contact_heading',label:content.contactTitle,target:content.contactTarget,visible:true})
 }
 for(const row of previous.filter(row=>!kept.includes(row.id)).sort((a,b)=>Number(b.parentId!==null)-Number(a.parentId!==null)))await db.delete(nodes).where(eq(nodes.id,row.id))
}
export async function readSiteNavigation(db:DatabaseExecutor,resourceId:bigint,type:'header'|'footer'){
 const nav=await db.select().from(nodes).where(eq(nodes.resourceId,resourceId)).orderBy(asc(nodes.sortOrder),asc(nodes.id))
 const link=(n:typeof nav[number]):SiteLink=>siteLinkSchema.parse({id:n.code,visible:n.visible,label:n.labels as Record<SiteLocale,string>,target:n.targetType==='custom'?{type:'custom',value:n.targetValue}:{resourceId:String(n.targetResourceId),module:n.module,type:n.targetType as Exclude<SiteLink['target']['type'],'custom'>,value:n.targetValue}})
 if(type==='header')return {items:nav.filter(n=>n.parentId===null).map(n=>({...link(n),children:nav.filter(c=>c.parentId===n.id).map(link)}))}
 const contact=nav.find(n=>n.parentId===null&&n.kind==='link'&&n.code==='contact_heading')
 return {contactTarget:contact?link(contact).target:null,groups:nav.filter(n=>n.parentId===null&&n.kind==='group').map(n=>({id:n.code,visible:n.visible,title:n.labels,items:nav.filter(c=>c.parentId===n.id).map(link)}))}
}
export const siteSettingsRepository={
 async find(db:DatabaseExecutor,lock:SiteSection|false=false){
  if(lock)await db.select().from(resources).where(eq(resources.key,`site.${lock}`)).for('update')
  const rows=await db.select().from(resources).where(inArray(resources.key,keys));if(!rows.length)return undefined
  const values=await db.select().from(drafts).where(inArray(drafts.resourceId,rows.map(r=>r.id))),content=createSiteSettings()
  for(const row of rows){const section=row.type as SiteSection,stored=values.find(d=>d.resourceId===row.id);if(stored)Object.assign(content[section],stored.content);if(section!=='basic')Object.assign(content[section],await readSiteNavigation(db,row.id,section))}
  const bySection=Object.fromEntries(rows.map(r=>[r.type,r])) as Record<SiteSection,typeof rows[number]>
  return {id:rows[0]!.id,resources:bySection,content,basicVersion:bySection.basic?.draftVersion??0,headerVersion:bySection.header?.draftVersion??0,footerVersion:bySection.footer?.draftVersion??0,basicReleaseId:bySection.basic?.publishedReleaseId??null,headerReleaseId:bySection.header?.publishedReleaseId??null,footerReleaseId:bySection.footer?.publishedReleaseId??null,updatedAt:rows.reduce((a,r)=>r.updatedAt>a?r.updatedAt:a,rows[0]!.updatedAt),updatedBy:rows.reduce((a,r)=>r.updatedAt>a.updatedAt?r:a,rows[0]!).updatedBy}
 },
 async insert(db:DatabaseExecutor,content:SiteSettings,actor:bigint,initialVersion=1){
  for(const section of siteSections){
   if((await db.select().from(resources).where(eq(resources.key,`site.${section}`))).length)continue
   const row=await withEntityIds(db,'website_resources',{key:`site.${section}`,type:section,createdBy:actor,updatedBy:actor,draftVersion:initialVersion});await db.insert(resources).values(row)
   const {items:_items,groups:_groups,contactTarget:_contactTarget,...value}=content[section] as Record<string,unknown>
   await db.insert(drafts).values({resourceId:row.id,settingsVersion:initialVersion,content:value,updatedBy:actor})
   if(section!=='basic')await writeSiteNavigation(db,row.id,content[section])
  }
 },
 async update(db:DatabaseExecutor,_id:bigint,input:SiteSettingsUpdate,actor:bigint){
  const [resource]=await db.select().from(resources).where(eq(resources.key,`site.${input.section}`));if(!resource)return false
  const [result]=await db.update(resources).set({draftVersion:sql`${resources.draftVersion}+1`,updatedBy:actor,updatedAt:new Date()}).where(and(eq(resources.id,resource.id),eq(resources.draftVersion,input.version),lt(resources.draftVersion,MAX_ENTITY_VERSION)))
  if(result.affectedRows!==1)return false
  const {items:_items,groups:_groups,contactTarget:_contactTarget,...content}=input.content as Record<string,unknown>
  await db.update(drafts).set({content,settingsVersion:sql`${drafts.settingsVersion}+1`,updatedBy:actor,updatedAt:new Date()}).where(eq(drafts.resourceId,resource.id))
  if(input.section!=='basic')await writeSiteNavigation(db,resource.id,input.content)
  return true
 }
}
