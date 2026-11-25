import {seedReferenceSystem} from '../fixtures/reference-seed'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {eq} from 'drizzle-orm'
import type {RowDataPacket} from 'mysql2'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedSystemData} from '../../scripts/database/seed/system'
import {seedRoot} from '../../scripts/database/seed/system'
import {checkDatabaseBaseline} from '../../scripts/database/baseline'
import {readMigrationManifest} from '../../scripts/lib/database.mjs'
import {migrateDatabase} from '../../scripts/lib/database-migrations.mjs'
import {websiteResourceRepository} from '../../server/repositories/website-resources'
import {adminParameters,adminTasks,websiteLanguageConfig,websiteResources,websiteDrafts} from '../../server/db/schema'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {fixturePageSettings} from '../fixtures/website-page-settings'
import {resetTestData} from './reset-data'

let client:Awaited<ReturnType<typeof setupTestDatabase>>
beforeAll(async()=>{client=await setupTestDatabase({seed:false})})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('系统阶段不填站点配置，补齐站点夹具后符合基线，重复初始化保留自定义值和独立版本',async()=>{
    const [[history]]=await client.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM __drizzle_migrations')
    expect(Number(history!.n)).toBe(readMigrationManifest('drizzle').length)
    const [[empty]]=await client.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM website_module_policy')
    expect(Number(empty!.n)).toBe(0)
    await seedSystemData(client.database)
    expect(await checkDatabaseBaseline(client)).toMatchObject({ok:false,failures:expect.arrayContaining(['singleton: website_module_policy','singleton: website_image_rules'])})
    await client.database.transaction(seedReferenceSystem)
    expect(await checkDatabaseBaseline(client)).toMatchObject({ok:true,failures:[]})
    await client.database.update(adminParameters).set({value:'50',version:7}).where(eq(adminParameters.key,'admin.list.defaultPageSize'))
    await client.database.update(adminTasks).set({enabled:false,schedule:{mode:'interval',minutes:20},version:7}).where(eq(adminTasks.code,'search_rebuild'))
    await client.database.update(websiteLanguageConfig).set({version:7,languages:{enabledLocales:['en'],defaultLocale:'en'}}).where(eq(websiteLanguageConfig.id,1))
    await client.pool.query("UPDATE website_module_policy SET policy=JSON_SET(policy,'$.enabled.news',CAST('false' AS JSON)),version=7 WHERE id=1")
    await client.pool.query("UPDATE website_image_rules SET rules=JSON_SET(rules,'$.newsCover.maxZoom',4) WHERE id=1")
    await client.pool.query("UPDATE website_renderers SET component_path='app/components/public/sections/common/ContactCallout.vue' WHERE scope='public' AND renderer_key='content.text'")
    await seedSystemData(client.database)
    expect((await client.database.select().from(adminParameters).where(eq(adminParameters.key,'admin.list.defaultPageSize')))[0]).toMatchObject({value:'50',version:7})
    expect((await client.database.select().from(adminTasks).where(eq(adminTasks.code,'search_rebuild')))[0]).toMatchObject({enabled:false,version:7,schedule:{mode:'interval',minutes:20}})
    expect((await client.database.select().from(websiteLanguageConfig))[0]).toMatchObject({version:7,languages:{enabledLocales:['en'],defaultLocale:'en'}})
    const [[policy]]=await client.pool.query<RowDataPacket[]>('SELECT version,policy FROM website_module_policy WHERE id=1')
    expect(policy).toMatchObject({version:7,policy:{enabled:{news:false}}})
    const [[rules]]=await client.pool.query<RowDataPacket[]>('SELECT rules FROM website_image_rules WHERE id=1')
    expect(rules!.rules.newsCover.maxZoom).toBe(4)
    const [[renderer]]=await client.pool.query<RowDataPacket[]>("SELECT component_path FROM website_renderers WHERE scope='public' AND renderer_key='content.text'")
    expect(renderer!.component_path).toBe('app/components/public/sections/common/ContactCallout.vue')
})

it('发布摘要与键顺序无关，重复迁移不改内容且保留全部迁移凭据',async()=>{
    const actor=BigInt((await seedRoot(client.database,'Baseline fixture Aurora 8462!')).id)
    const resource=await withEntityIds(client.database,'website_resources',{key:'page.baseline',type:'page' as const,createdBy:actor,updatedBy:actor})
    await client.database.insert(websiteResources).values(resource)
    await client.database.insert(websiteDrafts).values({resourceId:resource.id,content:fixturePageSettings(),updatedBy:actor})
    const content={settings:fixturePageSettings(),sections:[]}
    const release=await websiteResourceRepository.append(client.database,{resourceId:resource.id,draftVersion:1,content,createdBy:actor})
    const reversed={sections:[],settings:fixturePageSettings()}
    const second=await websiteResourceRepository.append(client.database,{resourceId:resource.id,draftVersion:1,content:reversed,createdBy:actor})
    const [initial]=await client.pool.query<RowDataPacket[]>('SELECT content_hash FROM website_releases WHERE id IN (?,?) ORDER BY id',[String(release.id),String(second.id)])
    expect(initial[0]!.content_hash).toBe(initial[1]!.content_hash)
    await client.pool.query('UPDATE website_releases SET content_hash=REPEAT(\'0\',64) WHERE id=?',[String(release.id)])
    expect((await checkDatabaseBaseline(client)).failures).toContain('websiteHash: 1')
    await client.pool.query('UPDATE website_releases SET content_hash=SHA2(CAST(content AS CHAR CHARACTER SET utf8mb4),256) WHERE id=?',[String(release.id)])
    await migrateDatabase(client,'drizzle')
    const [[history]]=await client.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM __drizzle_migrations')
    expect(Number(history!.n)).toBe(readMigrationManifest('drizzle').length)
    const [[stored]]=await client.pool.query<RowDataPacket[]>('SELECT content,content_hash=SHA2(CAST(content AS CHAR CHARACTER SET utf8mb4),256) AS valid FROM website_releases WHERE id=?',[String(release.id)])
    expect(stored!.content).toEqual(content)
    expect(Number(stored!.valid)).toBe(1)
    expect(await checkDatabaseBaseline(client)).toMatchObject({ok:true,failures:[]})
    const connection=await client.pool.getConnection()
    try {
        const [[identity]]=await connection.query<RowDataPacket[]>('SELECT DATABASE() AS name')
        const {createHash}=await import('node:crypto')
        const name='schema-migration:'+createHash('sha256').update(identity!.name).digest('hex').slice(0,32)
        await connection.query('SELECT GET_LOCK(?,0)',[name])
        await expect(migrateDatabase(client,'drizzle')).rejects.toThrow('DB_MIGRATION_BUSY')
        await connection.query('SELECT RELEASE_LOCK(?)',[name])
    } finally {connection.release()}
})

it('测试数据重建保留 Root 凭据并恢复语言、配置与字典初始化基线',async()=>{
    const [[before]]=await client.pool.query<RowDataPacket[]>('SELECT password_hash FROM admin_users WHERE is_root=1')
    await resetTestData(client.database)
    const [[after]]=await client.pool.query<RowDataPacket[]>('SELECT password_hash FROM admin_users WHERE is_root=1')
    expect(after!.password_hash).toBe(before!.password_hash)
    const [[items]]=await client.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM admin_dictionary_items')
    expect(Number(items!.n)).toBe(12)
    expect(await checkDatabaseBaseline(client)).toMatchObject({ok:true,failures:[]})
})
