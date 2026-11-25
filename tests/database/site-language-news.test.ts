import {languageMaintenance} from '../fixtures/site-language-maintenance'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {adminUsers} from '../../server/db/schema'
import {readWebsiteRouteTree,mutateWebsiteRouteNode,publishWebsiteRouteTree} from '../../server/services/website-route-tree'
import {readSiteLanguages} from '../../server/services/site-languages'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {createNewsService} from '../../server/services/news'
import {createPublicNewsService} from '../../server/services/public-news'
import {supportedLocales} from '../../shared/config/site-languages'

let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
const meta={ip:'local',userAgent:'site-language-news-test',requestId:'00000000-0000-4000-8000-000000000001'}
const languages=()=>languageMaintenance(client.database,actor,meta)
const tree=()=>readWebsiteRouteTree(client.database,actor)
const edit=async(input:object)=>mutateWebsiteRouteNode(client.database,actor,{...input,version:(await tree()).version},meta)
const publish=async()=>{const state=await tree();return publishWebsiteRouteTree(client.database,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId},meta)}
beforeAll(async()=>{
 client=await setupTestDatabase()
 actor=BigInt((await seedRoot(client.database,'Language news fixture Aurora 8462!')).id)
 await client.database.update(adminUsers).set({mustChangePassword:false})
 await seedWebsiteTemplates(client.database)
 await languages().save({enabledLocales:['zh','en'],defaultLocale:'zh'})
 await languages().publish()
})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('没有文章的启用分类也必须补齐新增语言，失败不切换公开配置，停用分类不阻止发布',async()=>{
 const db=client.database,pages=createWebsitePagesService(db),news=createNewsService(db)
 let page=await pages.read(actor,'news')
 const templates=['hero.news','news.list'].map(key=>page.templates.find(value=>value.key===key)!)
 page=await pages.settings(actor,'news',{version:page.settingsVersion,settings:{...page.settings,sceneEnabled:false},removed:[],sections:templates.map((template,index)=>({id:'new_'+index,templateId:template.id,templateKey:template.key,sortOrder:index,visible:true,anchorKey:'section_'+index,contentVersion:1,structureVersion:1}))},meta)
 const section=page.sections.find(value=>value.templateKey==='news.list')!
 page=await pages.section(actor,'news',section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:Object.fromEntries(supportedLocales.map(locale=>[locale,{copy:{all:'All',empty:'No news'},data:{pageSize:12,showFilters:true,showDate:true,showSummary:true}}]))},meta)
 const hero=page.sections.find(value=>value.templateKey==='hero.news')!
 page=await pages.section(actor,'news',hero.id,{contentVersion:hero.contentVersion,structureVersion:hero.structureVersion,shared:hero.shared,localized:Object.fromEntries(supportedLocales.map(locale=>[locale,{copy:{title:'News',intro:'Updates'},data:{}}]))},meta)
 await createWebsitePublishingService(db).publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:null},meta)
 await edit({action:'save',id:null,parentId:null,slug:'updates',targetType:'page',resourceId:page.resourceId})
 await edit({action:'seo',resourceId:page.resourceId,entries:['zh','en','fr'].map(locale=>({locale,title:'News',description:'Published news',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null}))})
 const names={zh:'分类',en:'Category',fr:'',es:'',pt:''}
 const category=await news.categorySave(actor,null,{code:'empty_category',name:names,sortOrder:0,enabled:true},meta)
 await news.categorySave(actor,null,{code:'disabled_category',name:names,sortOrder:1,enabled:false},meta)
 await publish()
 const previous=(await tree()).publishedReleaseId
 await languages().save({enabledLocales:['zh','en','fr'],defaultLocale:'zh'})
 await expect(languages().publish()).rejects.toMatchObject({code:'INVALID_INPUT',fields:[{message:expect.stringContaining('empty_category')} ]})
 expect((await tree()).publishedReleaseId).toBe(previous)
 expect((await readSiteLanguages(db)).enabledLocales).toEqual(['zh','en'])
 await news.categorySave(actor,category.id,{version:category.version,code:category.code,name:{...category.name,fr:'Catégorie'},sortOrder:category.sortOrder,enabled:true},meta)
 await languages().publish()
 const listing=await createPublicNewsService(db).list({locale:'fr'})
 expect(listing.items).toEqual([])
 expect(listing.categories).toEqual([{id:'empty_category',name:'Catégorie'}])
})
