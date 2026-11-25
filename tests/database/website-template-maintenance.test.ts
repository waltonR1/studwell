// 后台登记、配置修订、草稿升级及引用保护；只执行于专用测试库。
import {afterAll,beforeAll,expect,it} from 'vitest'
import {eq} from 'drizzle-orm'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {createTemplateConfigurationService} from '../../server/services/template-configuration'
import {createWebsiteTemplatesService} from '../../server/services/website-templates'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {adminUsers,websiteTemplateRevisions,websiteTemplates,websiteSections,websiteReleases} from '../../server/db/schema'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
import {createAccountService} from '../../server/services/accounts'
import {createMenuService} from '../../server/services/menus'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint,ordinary:bigint
const meta={ip:'local',userAgent:'template-maintenance',requestId:'00000000-0000-4000-8000-000000000001'}
const path='app/components/public/sections/common/TextContent.vue'
const definition=()=>{const result=structuredClone(templateDefinition('content.text')!);result.key='fixture.text';result.name='测试区块';result.publicRendererId=result.previewRendererId=result.key;if(result.editor)result.editor.key=result.key;result.allowedPages='all';return result}
beforeAll(async()=>{client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Template fixture Aurora 8462!')).id);await client.database.update(adminUsers).set({mustChangePassword:false});ordinary=BigInt((await createAccountService(client.database,false).createOrdinary({username:'template_denied',displayName:'无权限',password:'Template fixture Aurora 8462!'},String(actor))).id);await client.database.update(adminUsers).set({mustChangePassword:false});await seedWebsiteTemplates(client.database)})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
async function current(){return (await createWebsiteTemplatesService(client.database).read(actor)).find(row=>row.key==='fixture.text')!}
it('手工登记构建内组件，默认禁用；拒绝不存在路径、越界路径、重复编码和无权限操作',async()=>{
 const service=createTemplateConfigurationService(client.database),body={definition:definition(),publicComponentPath:path,previewComponentPath:path}
 await expect(service.register(actor,{...body,publicComponentPath:'app/components/public/sections/Missing.vue'},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await expect(service.register(actor,{...body,publicComponentPath:'app/components/admin/users/EditModule.vue'},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await expect(service.register(ordinary,body,meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 await service.register(actor,body,meta)
 expect(await current()).toMatchObject({enabledForNew:false,revision:1,definition:{key:'fixture.text'}})
 await expect(service.register(actor,body,meta)).rejects.toMatchObject({code:'CONFLICT'})
})
it('配置追加修订；字段结构、组件身份及过期凭据均被拒绝',async()=>{
 const service=createTemplateConfigurationService(client.database),item=await current(),next=structuredClone(item.definition!)
 next.category='后台分类';next.fields.label='新字段说明'
 await service.revise(actor,item.id,{version:item.metadataVersion,revision:item.revision,definition:next},meta)
 expect(await current()).toMatchObject({revision:2,definition:{category:'后台分类'}})
 expect((await client.database.select().from(websiteTemplateRevisions).where(eq(websiteTemplateRevisions.templateId,BigInt(item.id))))[0]!.definition.fields.label).not.toBe('新字段说明')
 await expect(service.revise(actor,item.id,{version:item.metadataVersion,revision:1,definition:next},meta)).rejects.toMatchObject({code:'CONFLICT'})
 const latest=await current()
 for(const mutate of [(d:typeof next)=>{d.publicRendererId='another'},(d:typeof next)=>{d.fields.fields!.injected={kind:'text',label:'新字段'}},(d:typeof next)=>{d.fields.fields!.copy!.kind='tree'}]){
  const changed=structuredClone(latest.definition!);mutate(changed)
  await expect(service.revise(actor,item.id,{version:latest.metadataVersion,revision:latest.revision,definition:changed},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 }
})
it('重复初始化不覆盖后台资料和新修订',async()=>{
 const item=(await createWebsiteTemplatesService(client.database).read(actor)).find(row=>row.key==='content.text')!
 const next=structuredClone(item.definition!);next.category='后台维护分类'
 await createTemplateConfigurationService(client.database).revise(actor,item.id,{version:item.metadataVersion,revision:item.revision,definition:next},meta)
 expect((await seedWebsiteTemplates(client.database)).created).toEqual([])
 const again=(await createWebsiteTemplatesService(client.database).read(actor)).find(row=>row.id===item.id)!
 expect(again).toMatchObject({revision:2,definition:{category:'后台维护分类'}})
})
it('显式升级只改草稿，工作区块及发布历史保护模板删除',async()=>{
 const db=client.database,templates=createWebsiteTemplatesService(db),pages=createWebsitePagesService(db),publishing=createWebsitePublishingService(db)
 let template=await current()
 await createMenuService(db).create(actor,{code:'website_services',name:'服务页面',iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:100,visible:true},meta)
 await templates.update(actor,template.id,{version:template.metadataVersion,name:template.name,description:'',coverMediaId:null,enabledForNew:true},meta)
 let page=await pages.read(actor,'services')
 page=await pages.settings(actor,page.key,{version:page.settingsVersion,settings:{...page.settings,sceneEnabled:false},removed:[],sections:[{id:'new_fixture',templateId:template.id,templateKey:template.key,sortOrder:0,visible:true,anchorKey:'body',contentVersion:1,structureVersion:1}]},meta)
 const section=page.sections[0]!
 page=await pages.section(actor,page.key,section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:'标题',body:'正文'}}]))},meta)
 await publishing.publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:null},meta)
 page=await pages.read(actor,page.key);const published=page.publication.publishedReleaseId
 const snapshot=(await db.select().from(websiteReleases).where(eq(websiteReleases.id,BigInt(published!))))[0]!.content
 template=await current();const revised=structuredClone(template.definition!);revised.fields.label='第三版说明'
 await createTemplateConfigurationService(db).revise(actor,template.id,{version:template.metadataVersion,revision:template.revision,definition:revised},meta)
 expect((await pages.read(actor,page.key)).sections[0]!.definition!.fields.label).not.toBe('第三版说明')
 const old=page.sections[0]!
 page=await pages.upgrade(actor,page.key,old.id,{contentVersion:old.contentVersion,structureVersion:old.structureVersion,revision:3},meta)
 expect(page.sections[0]!.definition!.fields.label).toBe('第三版说明')
 expect(page.publication.publishedReleaseId).toBe(published)
 expect((await db.select().from(websiteReleases).where(eq(websiteReleases.id,BigInt(published!))))[0]!.content).toEqual(snapshot)
 template=await current();await templates.update(actor,template.id,{version:template.metadataVersion,name:template.name,description:'',coverMediaId:null,enabledForNew:false},meta);template=await current()
 await expect(templates.remove(actor,template.id,{version:template.metadataVersion},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await db.delete(websiteSections).where(eq(websiteSections.id,BigInt(old.id)))
 await expect(templates.remove(actor,template.id,{version:template.metadataVersion},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
})
it('无引用模板可以后台删除，映射清理后允许重新登记',async()=>{
 const service=createTemplateConfigurationService(client.database),value=definition();value.key='fixture.removable';value.publicRendererId=value.previewRendererId=value.key;if(value.editor)value.editor.key=value.key
 const body={definition:value,publicComponentPath:path,previewComponentPath:path}
 await service.register(actor,body,meta)
 const templates=createWebsiteTemplatesService(client.database),item=(await templates.read(actor)).find(row=>row.key===value.key)!
 await templates.remove(actor,item.id,{version:item.metadataVersion},meta)
 expect(await client.database.select().from(websiteTemplates).where(eq(websiteTemplates.id,BigInt(item.id)))).toHaveLength(0)
 await expect(service.register(actor,body,meta)).resolves.toBeDefined()
})
