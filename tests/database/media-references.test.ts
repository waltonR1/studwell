// 通过真实媒体列表和更新接口核对业务位置，原始引用仍用于删除保护。
import {afterAll,beforeAll,expect,it} from 'vitest'
import {eq} from 'drizzle-orm'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {seedWebsiteTemplates} from '../fixtures/reference-seed'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import {createMediaService} from '../../server/services/media'
import {mediaRepository} from '../../server/repositories/media'
import {websiteResourceRepository as resources} from '../../server/repositories/website-resources'
import {adminUsers,mediaAssets,websiteResources,websiteSections,websiteTemplates} from '../../server/db/schema'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {supportedLocales} from '../../shared/config/site-languages'
import {fixturePageSettings} from '../fixtures/website-page-settings'
import {groupMediaReferences} from '../../app/utils/admin/media/references'
import type {MediaStorage} from '../../server/core/media-storage'
let client:Awaited<ReturnType<typeof setupTestDatabase>>
beforeAll(async()=>{client=await setupTestDatabase()})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('多语言图库引用显示页面、区块、分组和图片序号，更新资料后仍保留说明',async()=>{
    const db=client.database,actor=BigInt((await seedRoot(db,'Reference fixture Aurora 8462!')).id)
    await db.update(adminUsers).set({mustChangePassword:false}).where(eq(adminUsers.id,actor))
    await seedWebsiteTemplates(db)
    const template=(await db.select().from(websiteTemplates)).find(row=>row.key==='product.gallery')!
    const definition=templateDefinition('product.gallery')!
    const asset=await withEntityIds(db,'media_assets',{storageKey:'reference.png',name:'引用说明测试',originalName:'reference.png',kind:'image' as const,mime:'image/png',size:1,width:10,height:10,createdBy:actor,updatedBy:actor})
    await db.insert(mediaAssets).values(asset)
    const resource=await withEntityIds(db,'website_resources',{key:'page.products',type:'page' as const,createdBy:actor,updatedBy:actor})
    await db.insert(websiteResources).values(resource)
    const localized=Object.fromEntries(supportedLocales.map(locale=>[locale,{copy:{galleryTitle:'图库'},data:{groups:[{id:'one',name:locale==='zh'?'袋装水泥':'Bags',images:[{id:'photo',image:{mediaId:String(asset.id)}}]}]}}]))
    const section=await withEntityIds(db,'website_sections',{resourceId:resource.id,templateId:template.id,templateRevision:1,instanceName:'产品实拍',sortOrder:0,visible:true,anchorKey:'gallery',localizedContent:localized,sharedContent:{media:[]},createdBy:actor,updatedBy:actor})
    await db.insert(websiteSections).values(section)
    const snapshot={settings:fixturePageSettings(),sections:[{id:String(section.id),templateKey:'product.gallery',name:'产品实拍',definition:definition.fields,localized,shared:{media:[]}}]}
    const release=await resources.append(db,{resourceId:resource.id,draftVersion:1,content:snapshot,createdBy:actor})
    await resources.activate(db,resource.id,release.id)
    await db.transaction(async tx=>{
        // 每个 owner 一次性替换，保留所有语言的底层引用。
        await mediaRepository.replaceReferences(tx,'website:section:'+section.id,supportedLocales.map(locale=>({mediaId:asset.id,field:`localized.${locale}.data.groups.0.images.0.image.mediaId`})))
        await mediaRepository.replaceReferences(tx,'website:release:'+release.id,supportedLocales.map(locale=>({mediaId:asset.id,field:`sections.0.localized.${locale}.data.groups.0.images.0.image.mediaId`})))
    })
    const service=createMediaService(db,{} as MediaStorage)
    const list=await service.list(actor,{page:'1',pageSize:'20',search:'引用说明测试'})
    expect(list.items[0]!.references).toHaveLength(supportedLocales.length*2)
    const locations=groupMediaReferences(list.items[0]!.references)
    expect(locations).toHaveLength(2)
    expect(locations.find(row=>row.status==='草稿')).toMatchObject({source:'产品 · 产品实拍',location:'图库分组 · 袋装水泥 · 分组图片 · 第 1 张图片'})
    expect(locations.find(row=>row.status==='当前发布')).toMatchObject({source:'产品 · 产品实拍'})
    const updated=await service.update(actor,String(asset.id),{version:1,name:'引用说明测试',remark:'修改备注'},{ip:'local',userAgent:'fixture',requestId:'00000000-0000-4000-8000-000000000001'})
    expect(groupMediaReferences(updated.references)).toHaveLength(2)
    expect(()=>JSON.stringify(list)).not.toThrow()
    await expect(service.remove(actor,String(asset.id),updated.version,{ip:'local',userAgent:'fixture',requestId:'00000000-0000-4000-8000-000000000001'})).rejects.toMatchObject({reason:'REFERENCED'})
})
