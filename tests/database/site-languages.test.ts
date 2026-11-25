import {languageMaintenance} from '../fixtures/site-language-maintenance'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createPublicNewsService} from '../../server/services/public-news'
import {createPublicCareerService} from '../../server/services/public-careers'
import {websiteNavigationTargets} from '../../server/services/website-navigation-targets'
import {writeSearchIndexes} from '../../server/services/search-indexes'
import {createRbacService} from '../../server/services/rbac'
import {publicInquiryCategories} from '../../server/services/inquiry-settings'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {adminUsers} from '../../server/db/schema'
import {readWebsiteRouteTree,mutateWebsiteRouteNode,publishWebsiteRouteTree} from '../../server/services/website-route-tree'
import {readSiteLanguages} from '../../server/services/site-languages'
import {publicSiteSettings} from '../../server/services/public-site-settings'
import {publicWebsitePage} from '../../server/services/public-website-page'
import {previewWebsitePage} from '../../server/services/website-page-preview'
import {createMenuService} from '../../server/services/menus'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {readSearchSnapshots} from '../../server/services/published-search'
import {supportedLocales,defaultSiteLanguages} from '../../shared/config/site-languages'

let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
const meta={ip:'local',userAgent:'site-language-test',requestId:'00000000-0000-4000-8000-000000000001'}
const bilingual={enabledLocales:['zh','en'],defaultLocale:'zh'}
const languages=()=>languageMaintenance(client.database,actor,meta)
const tree=()=>readWebsiteRouteTree(client.database,actor)
const edit=async(input:object)=>mutateWebsiteRouteNode(client.database,actor,{...input,version:(await tree()).version},meta)
const publish=async(releaseId?:string)=>{const state=await tree();return publishWebsiteRouteTree(client.database,actor,{version:state.version,publishedReleaseId:state.publishedReleaseId,...(releaseId?{releaseId}:{})},meta)}
beforeAll(async()=>{
 client=await setupTestDatabase()
 actor=BigInt((await seedRoot(client.database,'Site language fixture Aurora 8462!')).id)
 await client.database.update(adminUsers).set({mustChangePassword:false})
 await seedWebsiteTemplates(client.database)
 await createRbacService(client.database).sync()
})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('语言草稿隔离、原子发布、历史回滚恢复五语言配置，回滚不覆盖草稿',async()=>{
 const db=client.database
 expect(await readSiteLanguages(db)).toEqual(defaultSiteLanguages)
 const legacy=await languages().publish()
 await languages().save(bilingual)
 expect((await languages().read()).languages).toEqual(bilingual)
 expect(await readSiteLanguages(db)).toEqual(defaultSiteLanguages)
 const two=await languages().publish()
 expect(await readSiteLanguages(db)).toEqual(bilingual)
 expect((await publicSiteSettings(db,{})).locale).toBe('zh')
 await expect(publicSiteSettings(db,{locale:'fr'})).rejects.toMatchObject({code:'NOT_FOUND'})
 await languages().publish(legacy.publishedReleaseId)
 expect(await readSiteLanguages(db)).toEqual(defaultSiteLanguages)
 expect((await languages().read()).languages).toEqual(bilingual)
 await languages().publish(two.publishedReleaseId)
 expect(await readSiteLanguages(db)).toEqual(bilingual)
})

it('只填写中英文即可发布页面及两语言 SEO，搜索范围一致，法语可编辑但不能公开访问或直接重新启用',async()=>{
 const {policy}=(await tree()).modulePolicy
 await edit({action:'module-policy',policy:{...policy,enabled:{news:false,careers:false}}})
 const db=client.database,pages=createWebsitePagesService(db)
 await createMenuService(db).create(actor,{code:'website_services',name:'Services',iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:100,visible:true},meta)
 let page=await pages.read(actor,'services')
 expect(page.templates.find(template=>template.key==='home.news')?.businessModules).toEqual([expect.objectContaining({key:'news',enabled:false})])
 const template=page.templates.find(value=>value.key==='content.text')!
 page=await pages.settings(actor,'services',{version:page.settingsVersion,settings:{...page.settings,sceneEnabled:false},removed:[],sections:[{id:'new_body',templateId:template.id,templateKey:template.key,sortOrder:0,visible:true,anchorKey:'body',contentVersion:1,structureVersion:1}]},meta)
 const section=page.sections[0]!
 page=await pages.section(actor,'services',section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:Object.fromEntries(supportedLocales.map(locale=>[locale,{copy:{title:locale==='zh'?'服务':locale==='en'?'Services':'',body:locale==='zh'?'中文正文':locale==='en'?'English body':''}}]))},meta)
 await createWebsitePublishingService(db).publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:null},meta)
 await edit({action:'save',id:null,parentId:null,slug:'services',targetType:'page',resourceId:page.resourceId})
 await edit({action:'seo',resourceId:page.resourceId,entries:['zh','en'].map(locale=>({locale,title:'Services',description:'Published services',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null}))})
 await publish()
 const live=await publicWebsitePage(db,'services',{})
 expect(live.locale).toBe('zh')
 expect(live.sections[0]?.content.copy).toMatchObject({body:'中文正文'})
 await expect(publicWebsitePage(db,'services',{locale:'fr'})).rejects.toMatchObject({code:'NOT_FOUND'})
 expect((await previewWebsitePage(db,actor,'services',{locale:'fr'})).page.locale).toBe('fr')
 expect((await publicSiteSettings(db,{})).modules).toEqual({news:false,careers:false,inquiries:true})
 expect((await websiteNavigationTargets(db)).some(target=>target.path==='/services')).toBe(true)
 expect((await publicInquiryCategories(db,'zh')).length).toBeGreaterThan(0)
 await expect(publicInquiryCategories(db,'fr')).rejects.toMatchObject({code:'NOT_FOUND'})
 expect((await createMenuService(db).navigation(actor)).items.some(item=>item.path?.startsWith('/admin/news')||item.path?.startsWith('/admin/careers'))).toBe(true)
 await expect(createPublicNewsService(db).list({})).rejects.toMatchObject({code:'NOT_FOUND'})
 await expect(createPublicCareerService(db).list({})).rejects.toMatchObject({code:'NOT_FOUND'})
 const snapshots=await readSearchSnapshots(db)
 expect(snapshots.map(value=>value.locale)).toEqual(['zh','en'])
 const directory=await mkdtemp(join(tmpdir(),'services-index-'))
 try{
  const versions=await writeSearchIndexes(directory,snapshots)
  expect(Object.keys(versions)).toEqual(['zh','en'])
  const index=JSON.parse(await readFile(join(directory,`zh.${versions.zh}.json`),'utf8'))
  expect(index.documents).toEqual([expect.objectContaining({path:'/services',type:'pages'})])
 }finally{await rm(directory,{recursive:true,force:true})}
 const before=(await tree()).publishedReleaseId
 await languages().save({enabledLocales:['zh','en','fr'],defaultLocale:'zh'})
 await expect(languages().publish()).rejects.toMatchObject({code:'INVALID_INPUT'})
 expect((await tree()).publishedReleaseId).toBe(before)
 expect(await readSiteLanguages(db)).toEqual(bilingual)
})
