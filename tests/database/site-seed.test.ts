import {eq} from 'drizzle-orm'
import {afterAll,beforeAll,it,expect} from 'vitest'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {tmpdir} from 'node:os'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedSystemData,seedRoot} from '../../scripts/database/seed/system'
import {seedSiteContent,templateSamples} from '../../scripts/database/seed/site'
import {site} from '../../scripts/database/seed/site'
import {websiteResourceRepository as resources} from '../../server/repositories/website-resources'
import {resourceSnapshot} from '../../server/services/website-read-model'
import {adminMenus,websiteModulePolicy,websiteImageRules,websiteRenderers,customerInquirySettings,adminDictionaryItems,websiteTemplates,adminUsers,newsArticles,careerPositions,mediaAssets,newsCategories} from '../../server/db/schema'
import {checkDatabaseBaseline} from '../../scripts/database/baseline'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,directory:string
beforeAll(async()=>{client=await setupTestDatabase({seed:false});directory=await mkdtemp(join(tmpdir(),'site-seed-'))})
afterAll(async()=>{try{if(client)await cleanTestDatabase(client)}finally{if(directory)await rm(directory,{recursive:true,force:true})}})
it('本站内容从统一声明安装；发布状态、草稿、引用及重复执行保持正确',async()=>{
 await seedSystemData(client.database);await seedRoot(client.database,'Site seed fixture Aurora 8462!');expect(await client.database.select().from(websiteTemplates)).toHaveLength(0)
 const result=await seedSiteContent(client.database,{mediaRoot:directory})
 expect(result.created).toHaveLength(site.pages.length+3)
 expect((await client.database.select().from(customerInquirySettings))[0]!.settings.categories).toEqual(site.business.inquiryCategories)
 expect(await client.database.select().from(adminDictionaryItems)).toHaveLength(0)
 expect(await client.database.select().from(websiteModulePolicy)).toHaveLength(1)
 expect(await client.database.select().from(websiteImageRules)).toHaveLength(1)
 expect((await client.database.select().from(websiteRenderers)).length).toBeGreaterThan(0)
 expect((await client.database.select().from(adminMenus)).filter(row=>row.pageKey==='website_page')).toHaveLength(site.pages.length)
 const installedResources=await resources.all(client.database),assets=await client.database.select().from(mediaAssets),categories=await client.database.select().from(newsCategories)
 const mediaKeys=new Map<string,string>()
 for(const asset of assets){const bytes=await readFile(join(directory,asset.storageKey));mediaKeys.set(String(asset.id),'media:'+createHash('sha256').update(bytes).digest('hex'))}
 function symbolic(value:unknown,key=''):unknown{
  if(Array.isArray(value))return value.map(v=>symbolic(v,key))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,symbolic(v,k)]))
  if(value===null)return null
  if(typeof value==='string'&&/^(media|page|category):/.test(value))return value
  if(['mediaId','logoId','faviconId','coverMediaId','ogMediaId'].includes(key))return mediaKeys.get(String(value))
  if(key==='resourceId')return 'page:'+installedResources.find(r=>String(r.id)===String(value))!.key.slice(5)
  if(key==='categoryId')return 'category:'+categories.find(c=>String(c.id)===String(value))!.code
  return value
 }
 const comparable=(snapshot:unknown)=>{const value=snapshot as {settings:unknown;sections:Array<{templateKey:string;name:string;sortOrder:number;visible:boolean;anchorKey:string;shared:unknown;localized:unknown}>};return {settings:value.settings,sections:value.sections.map(({templateKey,sortOrder,visible,anchorKey,shared,localized})=>({templateKey,sortOrder,visible,anchorKey,shared:symbolic(shared),localized:symbolic(localized)}))}}
 for(const spec of site.pages){const row=(await resources.find(client.database,'page.'+spec.key))!;expect(!!row.publishedReleaseId).toBe(!!spec.published)
  const draft=await resourceSnapshot(client.database,row);expect(comparable(draft)).toEqual(comparable(spec.draft))
  if(spec.published){const release=await resources.release(client.database,row.publishedReleaseId!,row.id);expect(comparable(release!.content)).toEqual(comparable(spec.published))}
 }
 expect(await client.database.select().from(newsArticles)).toHaveLength(site.business.news.length)
 expect(await client.database.select().from(careerPositions)).toHaveLength(site.business.careers.length)
 const templates=await client.database.select().from(websiteTemplates)
 for(const template of templates)expect(template.previewSample,template.key).toEqual(templateSamples[template.key])
 // Existing editor-owned samples survive; only a missing sample is filled.
 const preserved=structuredClone(templates[0]!.previewSample!);preserved.view.structure.displayName='管理员保留的样例'
 await client.database.update(websiteTemplates).set({previewSample:preserved}).where(eq(websiteTemplates.id,templates[0]!.id))
 await client.database.update(websiteTemplates).set({previewSample:null}).where(eq(websiteTemplates.id,templates[1]!.id))
 const configurationBefore={policy:await client.database.select().from(websiteModulePolicy),images:await client.database.select().from(websiteImageRules),renderers:await client.database.select().from(websiteRenderers),menus:await client.database.select().from(adminMenus)}
 const before=await resources.all(client.database),root=(await client.database.select().from(adminUsers))[0]
 expect(root!.mustChangePassword).toBe(true)
 expect((await seedSiteContent(client.database,{mediaRoot:directory})).created).toEqual([])
 expect(await resources.all(client.database)).toEqual(before)
 const afterTemplates=await client.database.select().from(websiteTemplates)
 expect(afterTemplates.find(t=>t.id===templates[0]!.id)!.previewSample).toEqual(preserved)
 expect(afterTemplates.find(t=>t.id===templates[1]!.id)!.previewSample).toEqual(templateSamples[templates[1]!.key])
 expect({policy:await client.database.select().from(websiteModulePolicy),images:await client.database.select().from(websiteImageRules),renderers:await client.database.select().from(websiteRenderers),menus:await client.database.select().from(adminMenus)}).toEqual(configurationBefore)
 expect((await checkDatabaseBaseline(client)).ok).toBe(true)
},180000)
