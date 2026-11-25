import {randomUUID} from 'node:crypto'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {createRbacService} from '../../server/services/rbac'
import {createMenuService} from '../../server/services/menus'
import {readSiteModuleState,updateSiteModuleState} from '../../server/services/site-module-maintenance'
import {readWebsiteModulePolicy,saveWebsiteModulePolicy} from '../../server/repositories/website-module-policy'
import {createWebsitePagesService} from '../../server/services/website-pages'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {createWebsitePageWithdrawalService} from '../../server/services/website-page-withdrawal'
import {createPublicNewsService} from '../../server/services/public-news'
import {createPublicCareerService} from '../../server/services/public-careers'
import {publicInquiryCategories} from '../../server/services/inquiry-settings'
import {createInquiryService} from '../../server/services/inquiries'
import {adminUsers} from '../../server/db/schema'
import {siteLocales} from '../../shared/schemas/admin/site-settings'

let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
const meta={ip:'127.0.0.1',userAgent:'site-module-test',requestId:randomUUID()}
beforeAll(async()=>{
 client=await setupTestDatabase()
 actor=BigInt((await seedRoot(client.database,'Module fixture Aurora 8462!')).id)
 await client.database.update(adminUsers).set({mustChangePassword:false})
 await seedWebsiteTemplates(client.database)
 await createRbacService(client.database).sync()
})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
it('公开接口由模块状态控制，无需发布任何页面；后台入口仍然保留',async()=>{
 const db=client.database
 expect((await createPublicNewsService(db).list({locale:'en'})).items).toEqual([])
 expect(await createPublicCareerService(db).list({locale:'en'})).toEqual([])
 for(const module of ['news','careers','inquiries'] as const){
  const state=await readSiteModuleState(db,actor,module)
  await updateSiteModuleState(db,actor,module,{version:state.version,enabled:false},meta)
 }
 await expect(createPublicNewsService(db).list({locale:'en'})).rejects.toMatchObject({code:'NOT_FOUND'})
 await expect(createPublicCareerService(db).list({locale:'en'})).rejects.toMatchObject({code:'NOT_FOUND'})
 await expect(publicInquiryCategories(db,'en')).rejects.toMatchObject({code:'NOT_FOUND'})
 await expect(createInquiryService(db,false,'https://example.test').submit({submissionKey:randomUUID(),name:'Visitor',email:'visitor@example.test',company:'',country:'',message:'Please contact us.',category:'general',locale:'en'})).rejects.toMatchObject({code:'NOT_FOUND'})
 const navigation=await createMenuService(db).navigation(actor)
 expect(navigation.items.some(item=>item.path==='/admin/news/articles')).toBe(true)
 expect(navigation.items.some(item=>item.path==='/admin/careers/positions')).toBe(true)
})
it('停用时可装配和编辑草稿，发布前须开启，有线上引用不能停用，下线页面不会自动关闭业务',async()=>{
 const db=client.database
 const current=await readWebsiteModulePolicy(db)
 current.policy.templates['content.text']={modules:['inquiries'],provides:['inquiries.form'],requires:[]}
 await saveWebsiteModulePolicy(db,current.policy,current.version)
 await createMenuService(db).create(actor,{code:'website_customer_services',name:'客户服务',iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:100,visible:true},meta)
 const pages=createWebsitePagesService(db)
 let page=await pages.read(actor,'customer_services')
 const template=page.templates.find(item=>item.key==='content.text')!
 expect(template.businessModules).toEqual([expect.objectContaining({key:'inquiries',enabled:false})])
 page=await pages.settings(actor,page.key,{version:page.settingsVersion,settings:page.settings,removed:[],sections:[{id:'new_body',templateId:template.id,templateKey:template.key,sortOrder:0,visible:true,anchorKey:'body',contentVersion:1,structureVersion:1}]},meta)
 const section=page.sections[0]!
 page=await pages.section(actor,page.key,section.id,{contentVersion:section.contentVersion,structureVersion:section.structureVersion,shared:section.shared,localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:'Services',body:'Contact our team.'}}]))},meta)
 const publish=()=>createWebsitePublishingService(db).publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:page.publication.publishedReleaseId},meta)
 await expect(publish()).rejects.toMatchObject({code:'INVALID_INPUT'})
 const disabled=await readSiteModuleState(db,actor,'inquiries')
 await updateSiteModuleState(db,actor,'inquiries',{version:disabled.version,enabled:true},meta)
 await publish()
 const enabled=await readSiteModuleState(db,actor,'inquiries')
 expect(enabled.usages).toEqual([expect.objectContaining({key:page.key})])
 await expect(updateSiteModuleState(db,actor,'inquiries',{version:enabled.version,enabled:false},meta)).rejects.toMatchObject({reason:'REFERENCED'})
 page=await pages.read(actor,page.key)
 await createWebsitePageWithdrawalService(db).withdraw(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:page.publication.publishedReleaseId},meta)
 const unused=await readSiteModuleState(db,actor,'inquiries')
 expect(unused).toMatchObject({enabled:true,usages:[]})
 await updateSiteModuleState(db,actor,'inquiries',{version:unused.version,enabled:false},meta)
 expect((await readSiteModuleState(db,actor,'inquiries')).enabled).toBe(false)
})
