import {afterAll,beforeAll,expect,it} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {adminUsers} from '../../server/db/schema'
import {createMenuService} from '../../server/services/menus'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {createWebsitePageWithdrawalService} from '../../server/services/website-page-withdrawal'
import {readWebsiteRouteTree,mutateWebsiteRouteNode,publishWebsiteRouteTree} from '../../server/services/website-route-tree'
import {lookupPublishedWebsiteRoute} from '../../server/repositories/website-route-tree'
import {publicSiteSettings} from '../../server/services/public-site-settings'
import {configRelease} from '../../server/repositories/website-site-config'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
import {siteSettingsRepository} from '../../server/repositories/site-settings'
import {createSiteSettings,createSiteLink} from '../../shared/utils/admin/site-settings'
import {createSiteSettingsService} from '../../server/services/site-settings'
import {publicPublicationFixture} from './fixtures/public-publication'

let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
const meta={ip:'local',userAgent:'route-enabled-test',requestId:'00000000-0000-4000-8000-000000000001'}
const tree=()=>readWebsiteRouteTree(client.database,actor)
const edit=async(input:object)=>mutateWebsiteRouteNode(client.database,actor,{version:(await tree()).version,...input},meta)
const publish=async(releaseId?:string)=>{const state=await tree();return publishWebsiteRouteTree(client.database,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId,...(releaseId?{releaseId}:{})},meta)}
beforeAll(async()=>{
 client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Route toggle fixture Aurora 8462!')).id)
 await client.database.update(adminUsers).set({mustChangePassword:false})
 await seedWebsiteTemplates(client.database)
})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
async function page(key:string){
 const db=client.database,pages=createWebsitePagesService(db)
 await createMenuService(db).create(actor,{code:'website_'+key,name:key,iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:100,visible:true},meta)
 let record=await pages.read(actor,key)
 const template=record.templates.find(item=>item.key==='content.text')!
 record=await pages.settings(actor,key,{version:record.settingsVersion,settings:record.settings,removed:[],sections:[{id:'new_body',templateId:template.id,templateKey:template.key,sortOrder:0,visible:true,anchorKey:'body',contentVersion:1,structureVersion:1}]},meta)
 const section=record.sections[0]!
 record=await pages.section(actor,key,section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:key,body:'Published page content'}}]))},meta)
 await publishPage(key)
 return record
}
async function publishPage(key:string){
 const db=client.database,record=await createWebsitePagesService(db).read(actor,key)
 return createWebsitePublishingService(db).publish(actor,record.resourceKey,{version:record.version,stateVersion:record.publication.stateVersion,publishedReleaseId:record.publication.publishedReleaseId},meta)
}
async function seo(resourceId:string,title:string){
 await edit({action:'seo',resourceId,entries:siteLocales.map(locale=>({locale,title,description:'Saved SEO description',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null}))})
}

it('路由停用需发布，保留配置和 SEO，允许页面下线，恢复时重新校验且不连带停用子路由',async()=>{
 const db=client.database,parent=await page('services'),child=await page('help')
 await edit({action:'save',id:null,parentId:null,slug:'services',targetType:'page',resourceId:parent.resourceId})
 const parentNode=(await tree()).draft.find(row=>row.resourceId===parent.resourceId)!
 await edit({action:'save',id:null,parentId:parentNode.id,slug:'help',targetType:'page',resourceId:child.resourceId})
 await seo(parent.resourceId!,'Services SEO');await seo(child.resourceId!,'Help SEO')
 const first=await publish()
 await edit({action:'set-enabled',id:parentNode.id,enabled:false})
 expect(await lookupPublishedWebsiteRoute(db,'/services')).toBeDefined()
 let record=await createWebsitePagesService(db).read(actor,parent.key)
 const withdraw=()=>createWebsitePageWithdrawalService(db).withdraw(actor,record.resourceKey,{version:record.version,stateVersion:record.publication.stateVersion,publishedReleaseId:record.publication.publishedReleaseId},meta)
 await expect(withdraw()).rejects.toMatchObject({code:'INVALID_INPUT'})
 const disabled=await publish()
 expect(await lookupPublishedWebsiteRoute(db,'/services')).toBeUndefined()
 expect(await lookupPublishedWebsiteRoute(db,'/services/help')).toBeDefined()
 expect((await publicSiteSettings(db,{locale:'en'})).pages.services).toBeUndefined()
 expect((await configRelease(db,BigInt(disabled.publishedReleaseId)))?.content.routes).toEqual(expect.arrayContaining([expect.objectContaining({path:'/services',enabled:false})]))
 expect((await tree()).seo).toEqual(expect.arrayContaining([expect.objectContaining({resourceId:parent.resourceId,title:'Services SEO'})]))
 await withdraw()
 await publish()
 await expect(publish(first.publishedReleaseId)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await edit({action:'set-enabled',id:parentNode.id,enabled:true})
 await expect(publish()).rejects.toMatchObject({code:'INVALID_INPUT'})
 await publishPage(parent.key)
 await publish()
 expect((await publicSiteSettings(db,{locale:'en'})).pages.services?.seo.title).toBe('Services SEO')
 expect(await lookupPublishedWebsiteRoute(db,'/services')).toBeDefined()
 await publish(disabled.publishedReleaseId)
 expect(await lookupPublishedWebsiteRoute(db,'/services')).toBeUndefined()
 // A disabled route still reserves its original address.
 await expect(edit({action:'save',id:null,parentId:null,slug:'services',targetType:'group',resourceId:null})).rejects.toMatchObject({code:'INVALID_INPUT'})
 record=await createWebsitePagesService(db).read(actor,parent.key)
 await withdraw()
})

it('已发布导航引用阻止停用生效，过期状态和分组开关被拒绝',async()=>{
 const db=client.database,parent=(await tree()).draft.find(row=>row.path==='/services')!
 await publishPage('services');await publish()
 await siteSettingsRepository.insert(db,createSiteSettings(),actor)
 const settings=createSiteSettingsService(db)
 let common=await settings.read(actor)
 common.content.header.items=[{...createSiteLink('services'),target:{module:'services',resourceId:parent.resourceId!,type:'page',value:''},children:[]}]
 common=await settings.update(actor,{section:'header',version:common.versions.header,content:common.content.header},meta)
 await publicPublicationFixture(db).publish(actor,{section:'header',version:common.versions.header,publishedReleaseId:null},meta)
 const oldVersion=(await tree()).version
 await edit({action:'set-enabled',id:parent.id,enabled:false})
 await expect(publish()).rejects.toMatchObject({code:'INVALID_INPUT'})
 expect(await lookupPublishedWebsiteRoute(db,'/services')).toBeDefined()
 await expect(mutateWebsiteRouteNode(db,actor,{version:oldVersion,action:'set-enabled',id:parent.id,enabled:true},meta)).rejects.toMatchObject({reason:'STALE'})
 await edit({action:'save',id:null,parentId:null,slug:'group',targetType:'group',resourceId:null})
 const group=(await tree()).draft.find(row=>row.path==='/group')!
 await expect(edit({action:'set-enabled',id:group.id,enabled:false})).rejects.toMatchObject({code:'INVALID_INPUT'})
})
