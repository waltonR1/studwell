import {languageMaintenance} from '../fixtures/site-language-maintenance'
import {beforeAll,afterAll,it,expect,vi} from 'vitest'
// 模拟重新部署增加德语资源，原有站点发布配置仍然只有原五语言。
vi.mock('../../shared/config/site-languages',async original=>{const source=await original<typeof import('../../shared/config/site-languages')>();return {...source,supportedLocales:[...source.supportedLocales,'de']}})
import {eq} from 'drizzle-orm'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {adminUsers,websiteReleases,websiteSections} from '../../server/db/schema'
import {createRbacService} from '../../server/services/rbac'
import {createMenuService} from '../../server/services/menus'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {readWebsiteRouteTree,mutateWebsiteRouteNode,publishWebsiteRouteTree} from '../../server/services/website-route-tree'
import {publicWebsitePage} from '../../server/services/public-website-page'
import {previewWebsitePage} from '../../server/services/website-page-preview'
import {readSearchSnapshots} from '../../server/services/published-search'
import {readSiteLanguages} from '../../server/services/site-languages'
import {initializeSectionDraft} from '../../app/utils/admin/website/page-assembly'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
const meta={ip:'local',userAgent:'new-language-test',requestId:'00000000-0000-4000-8000-000000000001'}
beforeAll(async()=>{client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Language fixture Aurora 8462!')).id);await client.database.update(adminUsers).set({mustChangePassword:false});await seedWebsiteTemplates(client.database);await createRbacService(client.database).sync()})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
it('新增未启用德语不影响稀疏语言的草稿、发布历史和公开读取；补齐后才允许启用',async()=>{
 const db=client.database,pages=createWebsitePagesService(db),publishing=createWebsitePublishingService(db)
 const languages=languageMaintenance(db,actor,meta)
 const tree=()=>readWebsiteRouteTree(db,actor)
 const edit=async(input:object)=>mutateWebsiteRouteNode(db,actor,{...input,version:(await tree()).version},meta)
 const publish=async()=>{const state=await tree();return publishWebsiteRouteTree(db,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId},meta)}
 const policy=(await tree()).modulePolicy.policy
 await edit({action:'module-policy',policy:{...policy,enabled:{news:false,careers:false}}})
 await languages.save({enabledLocales:['en'],defaultLocale:'en'})
 await languages.publish()
 await createMenuService(db).create(actor,{code:'website_services',name:'Services',iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:100,visible:true},meta)
 let page=await pages.read(actor,'services')
 const template=page.templates.find(value=>value.key==='content.text')!
 page=await pages.settings(actor,'services',{version:page.settingsVersion,settings:{...page.settings,displayName:{en:'Services'}},removed:[],sections:[{id:'new_body',templateId:template.id,templateKey:template.key,sortOrder:0,visible:true,anchorKey:'body',contentVersion:1,structureVersion:1}]},meta)
 let section=page.sections[0]!
 page=await pages.section(actor,'services',section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:{en:{copy:{title:'Services',body:'English body'}}}},meta)
 await publishing.publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:null},meta)
 await edit({action:'save',id:null,parentId:null,slug:'services',targetType:'page',resourceId:page.resourceId})
 await edit({action:'seo',resourceId:page.resourceId,entries:[{locale:'en',title:'Services',description:'Services description',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null}]})
 await publish()
 const [stored]=await db.select().from(websiteSections).where(eq(websiteSections.id,BigInt(section.id)))
 const [oldRelease]=await db.select().from(websiteReleases).where(eq(websiteReleases.resourceId,BigInt(page.resourceId!)))
 const saved=JSON.stringify(stored!.localizedContent),historical=JSON.stringify(oldRelease!.content)
 expect((await pages.read(actor,'services')).settings.displayName).toEqual({en:'Services'})
 expect((await publicWebsitePage(db,'services',{locale:'en'})).sections[0]?.content.copy).toMatchObject({body:'English body'})
 await expect(publicWebsitePage(db,'services',{locale:'de'})).rejects.toMatchObject({code:'NOT_FOUND'})
 const copy=structuredClone((await pages.read(actor,'services')).sections[0]!)
 initializeSectionDraft(copy)
 expect(copy.localized.de).toBeDefined()
 expect((await previewWebsitePage(db,actor,'services',{locale:'de'})).page.locale).toBe('de')
 expect((await readSearchSnapshots(db)).map(snapshot=>snapshot.locale)).toEqual(['en'])
 await languages.save({enabledLocales:['en','de'],defaultLocale:'en'})
 await expect(languages.publish()).rejects.toMatchObject({code:'INVALID_INPUT'})
 expect((await readSiteLanguages(db)).enabledLocales).toEqual(['en'])
 page=await pages.read(actor,'services');section=page.sections[0]!
 page=await pages.section(actor,'services',section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:{...section.localized,de:{copy:{title:'Dienstleistungen',body:'Deutscher Inhalt'}}}},meta)
 await publishing.publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:page.publication.publishedReleaseId},meta)
 await edit({action:'seo',resourceId:page.resourceId,entries:[{locale:'de',title:'Dienstleistungen',description:'Deutsche Beschreibung',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null}]})
 await publish()
 await languages.publish()
 expect((await publicWebsitePage(db,'services',{locale:'de'})).sections[0]?.content.copy).toMatchObject({body:'Deutscher Inhalt'})
 const [historyAfter]=await db.select().from(websiteReleases).where(eq(websiteReleases.id,oldRelease!.id))
 expect(JSON.stringify(historyAfter!.content)).toBe(historical)
 expect(saved).not.toContain('"de"')
})
