// 模板和页面均使用非预设代称，验证业务适配器只按数据库能力识别。
import {beforeAll,afterAll,it,expect} from 'vitest'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {websiteResources,websitePublishedRoutes,newsCategories} from '../../server/db/schema'
import {websiteResourceRepository as resources} from '../../server/repositories/website-resources'
import {readWebsiteModulePolicy,saveWebsiteModulePolicy} from '../../server/repositories/website-module-policy'
import {findDetailProvider} from '../../server/services/website-detail-providers'
import {websiteNavigationTargets} from '../../server/services/website-navigation-targets'
import {validateWebsiteBusinessLanguages} from '../../server/services/website-publication-providers'
import {projectPageCapabilities} from '../../server/services/website-navigation-providers'
import {isNewsSearchPage} from '../../server/services/news-search-pages'
import {newsDetailPath} from '../../shared/utils/website/news-route'
import {emptyPageSettings} from '../../shared/utils/website/page-layouts'
import {siteLocales} from '../../shared/schemas/admin/site-settings'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint
beforeAll(async()=>{client=await setupTestDatabase();actor=BigInt((await seedRoot(client.database,'Capability fixture Aurora 9621!')).id)})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})
it('任意代称仍支持详情识别、搜索、分类导航及语言校验，锚点采用真实区块配置',async()=>{
 const db=client.database,{policy,version}=await readWebsiteModulePolicy(db)
 policy.templates['customer.feed']={modules:['news'],provides:['news.list'],requires:[]}
 policy.templates['customer.story']={modules:['news'],provides:['news.article'],requires:[]}
 await saveWebsiteModulePolicy(db,policy,version)
 const category=await withEntityIds(db,'news_categories',{code:'featured',name:Object.fromEntries(siteLocales.map(locale=>[locale,locale==='fr'?'':'Featured'])),sortOrder:0,enabled:true,createdBy:actor,updatedBy:actor})
 await db.insert(newsCategories).values(category)
 const stored=[]
 for(const [key,templateKey,path,anchorKey] of [['journal','customer.feed','/journal','latest-stories'],['story','customer.story','/journal/:slug','story-body']]){
  const page=await withEntityIds(db,'website_resources',{key:'page.'+key,type:'page' as const,createdBy:actor,updatedBy:actor})
  await db.insert(websiteResources).values(page)
  const snapshot={settings:emptyPageSettings(),sections:[{id:'2026111809000000001',templateKey,sortOrder:0,visible:true,anchorKey,name:'Content'}]}
  const release=await resources.append(db,{resourceId:page.id,draftVersion:1,content:snapshot,createdBy:actor})
  await resources.activate(db,page.id,release.id)
  await db.insert(websitePublishedRoutes).values({path,resourceId:page.id,routeNodeId:null})
  stored.push({snapshot,path})
 }
 const listing=projectPageCapabilities(policy,{path:stored[0]!.path,sections:stored[0]!.snapshot.sections})
 const detail=projectPageCapabilities(policy,{path:stored[1]!.path,sections:stored[1]!.snapshot.sections})
 expect((await findDetailProvider(db,'slug',stored[1]!.snapshot))?.type).toBe('news')
 expect(isNewsSearchPage(listing)).toBe(true)
 expect(newsDetailPath([listing,detail],'/journal','launch')).toBe('/journal/launch')
 expect((await websiteNavigationTargets(db)).find(target=>target.target.type==='news-category')?.path).toBe('/journal?category=featured#latest-stories')
 await expect(validateWebsiteBusinessLanguages(db,[stored[0]!.snapshot],['fr'])).rejects.toMatchObject({code:'INVALID_INPUT'})
 await expect(validateWebsiteBusinessLanguages(db,[stored[0]!.snapshot],['en'])).resolves.toBeUndefined()
})
