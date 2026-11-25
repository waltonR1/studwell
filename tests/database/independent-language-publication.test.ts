import {adminUsers} from '../../server/db/schema'
import {beforeAll,afterAll,it,expect} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {createRbacService} from '../../server/services/rbac'
import {createMenuService} from '../../server/services/menus'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {readWebsiteRouteTree,mutateWebsiteRouteNode,publishWebsiteRouteTree} from '../../server/services/website-route-tree'
import {languageMaintenance} from '../fixtures/site-language-maintenance'
import {publishSiteLanguages} from '../../server/services/site-language-maintenance'
import {readSiteLanguages} from '../../server/services/site-languages'
import {publicWebsitePage} from '../../server/services/public-website-page'
import {publicSiteSettings} from '../../server/services/public-site-settings'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
const meta={ip:'local',userAgent:'independent-language-test',requestId:'00000000-0000-4000-8000-000000000001'}
beforeAll(async()=>{client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Independent languages Aurora 8462!')).id);await client.database.update(adminUsers).set({mustChangePassword:false});await seedWebsiteTemplates(client.database);await createRbacService(client.database).sync()})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
it('语言与路由独立发布回滚：不读取另一侧草稿，版本与历史互不推进',async()=>{
 const db=client.database,languages=languageMaintenance(db,actor,meta)
 const tree=()=>readWebsiteRouteTree(db,actor)
 const edit=async(input:object)=>mutateWebsiteRouteNode(db,actor,{...input,version:(await tree()).version},meta)
 const publish=async(releaseId?:string)=>{const state=await tree();return publishWebsiteRouteTree(db,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId,...(releaseId?{releaseId}:{})},meta)}
 const policy=(await tree()).modulePolicy.policy
 await edit({action:'module-policy',policy:{...policy,enabled:{news:false,careers:false}}})
 await languages.save({enabledLocales:['en'],defaultLocale:'en'});await languages.publish()
 await createMenuService(db).create(actor,{code:'website_services',name:'Services',iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:100,visible:true},meta)
 const pages=createWebsitePagesService(db)
 let page=await pages.read(actor,'services');const template=page.templates.find(item=>item.key==='content.text')!
 page=await pages.settings(actor,'services',{version:page.settingsVersion,settings:page.settings,removed:[],sections:[{id:'new_body',templateId:template.id,templateKey:template.key,sortOrder:0,visible:true,anchorKey:'body',contentVersion:1,structureVersion:1}]},meta)
 const section=page.sections[0]!
 page=await pages.section(actor,'services',section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:{en:{copy:{title:'Services',body:'English body'}},zh:{copy:{title:'服务',body:'中文正文'}}}},meta)
 await createWebsitePublishingService(db).publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:null},meta)
 await edit({action:'save',id:null,parentId:null,slug:'services',targetType:'page',resourceId:page.resourceId})
 const seo=(locale:string,title:string)=>({locale,title,description:'Description',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null})
 await edit({action:'seo',resourceId:page.resourceId,entries:[seo('en','Online services')]})
 const englishRoute=await publish()
 await edit({action:'seo',resourceId:page.resourceId,entries:[seo('zh','中文服务')]})
 await languages.save({enabledLocales:['en','zh'],defaultLocale:'en'})
 const beforeFailure=await languages.read()
 await expect(languages.publish()).rejects.toMatchObject({code:'INVALID_INPUT'})
 expect((await languages.read()).publishedReleaseId).toBe(beforeFailure.publishedReleaseId)
 const languageBeforeRoutes=await languages.read()
 const bilingualRoute=await publish()
 expect(await languages.read()).toEqual(languageBeforeRoutes)
 const routesBeforeLanguages=await tree()
 const bilingual=await languages.publish()
 expect(await tree()).toEqual(routesBeforeLanguages)
 expect((await publicWebsitePage(db,'services',{locale:'zh'})).locale).toBe('zh')
 const node=(await tree()).draft.find(row=>row.resourceId===page.resourceId)!
 await edit({action:'save',id:node.id,parentId:null,slug:'pending-services',targetType:'page',resourceId:page.resourceId})
 await edit({action:'seo',resourceId:page.resourceId,entries:[seo('en','Pending title')]})
 const routeDraft=await tree()
 await languages.save({enabledLocales:['en'],defaultLocale:'en'});await languages.publish()
 expect(await tree()).toEqual(routeDraft)
 expect((await publicSiteSettings(db,{locale:'en'})).pages.services?.path).toBe('/services')
 expect((await publicSiteSettings(db,{locale:'en'})).pages.services?.seo.title).toBe('Online services')
 await languages.save({enabledLocales:['en','fr'],defaultLocale:'en'})
 const languageDraft=await languages.read()
 await publish()
 expect(await languages.read()).toEqual(languageDraft)
 expect((await publicSiteSettings(db,{locale:'en'})).pages.services?.path).toBe('/pending-services')
 const afterRoute=await tree()
 await languages.publish(bilingual.publishedReleaseId)
 expect(await tree()).toEqual(afterRoute)
 expect((await languages.read()).languages).toEqual({enabledLocales:['en','fr'],defaultLocale:'en'})
 expect((await readSiteLanguages(db)).enabledLocales).toEqual(['en','zh'])
 const languageBeforeRollback=await languages.read()
 await expect(publish(englishRoute.publishedReleaseId)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await publish(bilingualRoute.publishedReleaseId)
 expect(await languages.read()).toEqual(languageBeforeRollback)
 const stale=await languages.read();await languages.save({enabledLocales:['en'],defaultLocale:'en'})
 await expect(publishSiteLanguages(db,actor,{version:stale.version,publishedReleaseId:stale.publishedReleaseId},meta)).rejects.toMatchObject({code:'CONFLICT'})
})
