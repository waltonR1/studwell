import {site} from '../../scripts/database/seed/site'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {fixturePageSettings} from '../fixtures/website-page-settings'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {seedSiteContent} from '../../scripts/database/seed/site.ts'
import {site as siteSeed} from '../../scripts/database/seed/site'
import {publicSiteSettings} from '../../server/services/public-site-settings'
import {afterAll, beforeAll, expect, it} from 'vitest'
import {eq} from 'drizzle-orm'
import {setupTestDatabase, cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../../scripts/database/seed/site'
import {websiteTemplateCatalog,templateSamples} from '../../scripts/database/seed/site'
import {seedSystemData} from '../../scripts/database/seed/system'
import {seedPresets} from '../../scripts/database/seed/samples'
import {seedSamples} from '../../scripts/database/seed/samples'
import {adminMenus,websiteModulePolicy,websiteImageRules,websiteRenderers,adminUsers, adminParameters, adminRoles, adminDictionaryItems, websiteResources, websiteTemplates, websiteDrafts, customerInquirySettings, customerInquiryMail, newsArticles, careerPositions} from '../../server/db/schema'

let client: Awaited<ReturnType<typeof setupTestDatabase>>
const password = 'Fixture Root Aurora 7943!'
beforeAll(async () => {client = await setupTestDatabase({seed:false})})
afterAll(async () => {if (client) await cleanTestDatabase(client)})

it('必要系统数据与可选样例彼此独立，重复补充不覆盖已有数据', async () => {
    const db=client.database
    expect(await db.select().from(adminParameters)).toHaveLength(0)
    await expect(seedPresets(db,password)).rejects.toThrow('DB_PRESETS_ROOT_REQUIRED')
    await seedSystemData(db)
    expect(await db.select().from(adminParameters)).toHaveLength(28)
    expect(await db.select().from(adminDictionaryItems)).toHaveLength(0)
    expect((await db.select().from(customerInquirySettings))[0]!.settings.categories).toEqual([])
    expect(await db.select().from(adminUsers)).toHaveLength(0)
    expect(await db.select().from(websiteResources)).toHaveLength(0)
    expect(await db.select().from(websiteModulePolicy)).toHaveLength(0)
    expect(await db.select().from(websiteImageRules)).toHaveLength(0)
    expect(await db.select().from(websiteRenderers)).toHaveLength(0)
    expect((await db.select().from(adminMenus)).filter(row=>row.pageKey==='website_page')).toHaveLength(0)
    await db.update(adminParameters).set({value:'50',version:2}).where(eq(adminParameters.key,'admin.list.defaultPageSize'))
    await seedSystemData(db)
    expect((await db.select().from(adminParameters).where(eq(adminParameters.key,'admin.list.defaultPageSize')))[0]).toMatchObject({value:'50',version:2})
    await seedRoot(db,password)
    await seedSystemData(db)
    expect(await db.select().from(websiteTemplates)).toHaveLength(0)
    expect((await seedWebsiteTemplates(db)).created).toHaveLength(websiteTemplateCatalog.length)
    expect((await seedWebsiteTemplates(db)).created).toEqual([])
    await expect(seedSamples(db,password)).rejects.toThrow('DB_SAMPLE_SITE_REQUIRED')
    const [root]=await db.select().from(adminUsers).where(eq(adminUsers.isRoot,true))
    const page=await withEntityIds(db,'website_resources',{key:'page.sample_fixture',type:'page' as const,createdBy:root!.id,updatedBy:root!.id})
    await db.insert(websiteResources).values(page)
    await db.insert(websiteDrafts).values({resourceId:page.id,content:fixturePageSettings(),updatedBy:root!.id})
    await db.insert(adminMenus).values(await withEntityIds(db,'admin_menus',{code:'website_sample_fixture',name:'样例测试页',pageKey:'website_page',iconKey:'file-text',sortOrder:0,visible:true}))
    await expect(seedPresets(db,'123')).rejects.toMatchObject({code:'INVALID_INPUT'})
    expect(await db.select().from(adminRoles)).toHaveLength(0)

    expect(await seedSamples(db,password)).toMatchObject({accounts:{accounts:expect.any(Array)},inquiries:0})
    expect(await db.select().from(adminDictionaryItems)).toHaveLength(12)
    const inquirySettings=(await db.select().from(customerInquirySettings))[0]!
    await db.update(customerInquirySettings).set({settings:{...inquirySettings.settings,categories:site.business.inquiryCategories}})
    expect(await seedSamples(db)).toMatchObject({accounts:{accounts:[]},inquiries:1})
    expect(await db.select().from(adminUsers)).toHaveLength(7)
    await db.update(adminDictionaryItems).set({name:'自定义信息部门'}).where(eq(adminDictionaryItems.code,'information'))
    expect(await seedSamples(db)).toMatchObject({accounts:{accounts:[]},inquiries:0})
    expect((await db.select().from(adminDictionaryItems).where(eq(adminDictionaryItems.code,'information')))[0]!.name).toBe('自定义信息部门')
    expect(await db.select().from(customerInquiryMail)).toHaveLength(0)
    expect(await db.select().from(newsArticles)).toHaveLength(0)
    expect(await db.select().from(careerPositions)).toHaveLength(0)
})


it('首次登录前可安装展示内容，重复执行保留 Root 与发布状态',async()=>{
    const mediaRoot=await mkdtemp(join(tmpdir(),'studwell-install-'))
    try{
        const [root]=await client.database.select().from(adminUsers).where(eq(adminUsers.isRoot,true))
        expect(root!.mustChangePassword).toBe(true)
        const installed=await seedSiteContent(client.database,{mediaRoot})
        expect(new Set(installed.created)).toEqual(new Set([...siteSeed.pages.map(page=>'page.'+page.key),'site.basic','site.header','site.footer']))
        const site=await publicSiteSettings(client.database,{locale:'zh'})
        expect(site.languages).toEqual(siteSeed.languages.published)
        expect(site.header!.items).toHaveLength(6)
        expect(site.footer!.groups).toHaveLength(1)
        const templates=await client.database.select().from(websiteTemplates)
        for(const template of templates){
            expect(template.previewSample).not.toBeNull()
            expect(template.previewSample).toEqual(templateSamples[template.key])
        }
        const [installedRoot]=await client.database.select().from(adminUsers).where(eq(adminUsers.isRoot,true))
        expect(installedRoot).toMatchObject({passwordHash:root!.passwordHash,mustChangePassword:true})
        const before=await client.database.select().from(websiteResources)
        expect((await seedSiteContent(client.database,{mediaRoot})).created).toEqual([])
        expect(await client.database.select().from(websiteResources)).toEqual(before)
        expect((await client.database.select().from(adminUsers).where(eq(adminUsers.isRoot,true)))[0]).toEqual(installedRoot)
    }finally{await rm(mediaRoot,{recursive:true,force:true})}
})
