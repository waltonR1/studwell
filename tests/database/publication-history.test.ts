// 使用真实外键及事务验证历史清理边界；只运行于专用测试库。
import {afterAll,beforeAll,expect,it,vi} from 'vitest'
import {eq} from 'drizzle-orm'
import {setupTestDatabase,cleanTestDatabase} from './support'
import {seedRoot} from '../../scripts/database/seed/system'
import {withEntityIds} from '../../server/db/allocate-entity-id'
import {adminUsers,mediaAssets,websiteResources,websiteSiteConfig,websiteLanguageConfig} from '../../server/db/schema'
import {websiteResourceRepository as resources} from '../../server/repositories/website-resources'
import {newsRepository as news} from '../../server/repositories/news'
import {mediaRepository as media} from '../../server/repositories/media'
import {appendConfigRelease,configRelease} from '../../server/repositories/website-site-config'
import {appendLanguageRelease,languageRelease} from '../../server/repositories/site-languages'
import {cleanupPublicationHistory} from '../../server/services/publication-history'
import {auditService} from '../../server/services/audit'
import {createAccountService} from '../../server/services/accounts'
import {defaultSiteLanguages} from '../../shared/config/site-languages'
import {emptyNewsContent} from '../../shared/schemas/admin/news'
import {publicationMetadata} from '../../server/services/publication-metadata'
import {createWebsitePublishingService} from '../../server/services/website-publishing'
import {readSiteLanguageState} from '../../server/services/site-language-maintenance'
import {readWebsiteRouteTree} from '../../server/services/website-route-tree'
let client:Awaited<ReturnType<typeof setupTestDatabase>>,actor:bigint,deniedActor:bigint,assetId:bigint
const meta={ip:'local',userAgent:'history-fixture',requestId:'00000000-0000-4000-8000-000000000002'}
beforeAll(async()=>{
 client=await setupTestDatabase()
 const db=client.database
 actor=BigInt((await seedRoot(db,'History fixture Aurora mist 8462!')).id)
 await db.update(adminUsers).set({mustChangePassword:false}).where(eq(adminUsers.id,actor))
 deniedActor=BigInt((await createAccountService(db,false).createOrdinary({username:'history_denied',displayName:'无清理权限',password:'History fixture Aurora mist 8462!'},String(actor))).id)
 await db.update(adminUsers).set({mustChangePassword:false}).where(eq(adminUsers.id,deniedActor))
 const asset=await withEntityIds(db,'media_assets',{storageKey:'history.png',name:'历史图片',originalName:'history.png',kind:'image' as const,mime:'image/png',size:1,width:10,height:10,createdBy:actor,updatedBy:actor})
 await db.insert(mediaAssets).values(asset);assetId=asset.id
})
afterAll(async()=>{if(client)await cleanTestDatabase(client)})

it('保护当前版本、拒绝过期状态和跨对象清理；释放指定历史引用且保留其他快照',async()=>{
 const db=client.database
 const row=await withEntityIds(db,'website_resources',{key:'site.basic',type:'basic' as const,createdBy:actor,updatedBy:actor})
 await db.insert(websiteResources).values(row)
 const old=await resources.append(db,{resourceId:row.id,draftVersion:1,content:{logoId:String(assetId)},createdBy:actor})
 const current=await resources.append(db,{resourceId:row.id,draftVersion:1,content:{logoId:String(assetId)},restoredFrom:old.id,createdBy:actor})
 await resources.activate(db,row.id,current.id)
 for(const release of [old,current])await media.replaceReferences(db,`website:release:${release.id}`,[{mediaId:assetId,field:'logoId'}])
 const body={kind:'website' as const,key:'site.basic',version:1,stateVersion:2,publishedReleaseId:String(current.id),releaseId:String(old.id)}
 await expect(cleanupPublicationHistory(db,actor,{...body,releaseId:String(current.id)},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await expect(cleanupPublicationHistory(db,actor,{...body,stateVersion:1},meta)).rejects.toMatchObject({code:'CONFLICT'})
 const other=await withEntityIds(db,'website_resources',{key:'site.footer',type:'footer' as const,createdBy:actor,updatedBy:actor})
 await db.insert(websiteResources).values(other)
 await expect(cleanupPublicationHistory(db,actor,{...body,key:'site.footer',stateVersion:1,publishedReleaseId:null},meta)).rejects.toMatchObject({code:'NOT_FOUND'})
 await expect(cleanupPublicationHistory(db,deniedActor,body,meta)).rejects.toMatchObject({code:'FORBIDDEN'})
 expect(await cleanupPublicationHistory(db,actor,body,meta)).toEqual({deleted:true})
 expect(await resources.release(db,old.id,row.id)).toBeUndefined()
 expect(await resources.release(db,current.id,row.id)).toMatchObject({restoredFrom:null,content:current.content})
 expect(await resources.find(db,'site.basic')).toMatchObject({draftVersion:1,stateVersion:3,publishedReleaseId:current.id})
 expect((await media.references(db,[assetId])).map(r=>r.owner)).toEqual([`website:release:${current.id}`])
 expect(await media.find(db,assetId)).toBeDefined()
})

it('成功审计失败时快照、恢复指针、媒体引用与版本全部回滚',async()=>{
 const db=client.database,row=(await resources.find(db,'site.basic'))!
 const old=await resources.append(db,{resourceId:row.id,draftVersion:1,content:{logoId:String(assetId)},createdBy:actor})
 await media.replaceReferences(db,`website:release:${old.id}`,[{mediaId:assetId,field:'logoId'}])
 const spy=vi.spyOn(auditService,'write').mockImplementation(async()=>{throw new Error('AUDIT_FAILED')})
 try{await expect(cleanupPublicationHistory(db,actor,{kind:'website',key:row.key,version:1,stateVersion:row.stateVersion,publishedReleaseId:String(row.publishedReleaseId),releaseId:String(old.id)},meta)).rejects.toBeDefined()}
 finally{spy.mockRestore()}
 expect(await resources.release(db,old.id,row.id)).toBeDefined()
 expect((await media.references(db,[assetId])).some(r=>r.owner===`website:release:${old.id}`)).toBe(true)
 expect((await resources.find(db,row.key))!.stateVersion).toBe(row.stateVersion)
})

it('并发清理共用对象锁和状态版本，旧凭据只能成功一次',async()=>{
 const db=client.database,row=(await resources.find(db,'site.basic'))!
 const one=await resources.append(db,{resourceId:row.id,draftVersion:1,content:{},createdBy:actor})
 const two=await resources.append(db,{resourceId:row.id,draftVersion:1,content:{},createdBy:actor})
 const body={kind:'website' as const,key:row.key,version:1,stateVersion:row.stateVersion,publishedReleaseId:String(row.publishedReleaseId)}
 const results=await Promise.allSettled([one,two].map(release=>cleanupPublicationHistory(db,actor,{...body,releaseId:String(release.id)},meta)))
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
 expect(results.filter(result=>result.status==='rejected')).toHaveLength(1)
 expect((await resources.listReleases(db,row.id)).filter(release=>release.id===one.id||release.id===two.id)).toHaveLength(1)
})

it('新闻历史清理解除恢复来源，保留当前正文和草稿',async()=>{
 const db=client.database
 const category=await news.insertCategory(db,{code:'history',name:{zh:'历史',en:'History',fr:'History',es:'History',pt:'History'},sortOrder:0,enabled:true},actor)
 const content=emptyNewsContent(String(category)),articleId=await news.insertArticle(db,'history',content,actor)
 const value={articleId,categoryId:category,content,draftVersion:1,displayDate:content.displayDate,featured:false,featuredOrder:0,createdBy:actor}
 const old=await news.append(db,value),current=await news.append(db,{...value,restoredFrom:old.id})
 await news.activate(db,articleId,current.id,actor)
 await media.replaceReferences(db,`news:release:${old.id}`,[{mediaId:assetId,field:'coverMediaId'}])
 const body={kind:'news' as const,articleId:String(articleId),version:1,stateVersion:2,publishedReleaseId:String(current.id),releaseId:String(old.id)}
 await expect(cleanupPublicationHistory(db,actor,{...body,releaseId:String(current.id)},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await cleanupPublicationHistory(db,actor,body,meta)
 expect(await news.release(db,old.id,articleId)).toBeUndefined()
 expect(await news.release(db,current.id,articleId)).toMatchObject({restoredFrom:null,content})
 expect(await news.article(db,articleId)).toMatchObject({draftVersion:1,stateVersion:3,publishedReleaseId:current.id,content})
 expect((await media.references(db,[assetId])).some(r=>r.owner===`news:release:${old.id}`)).toBe(false)
})

it('路由与语言历史清理保护当前指针，释放历史 SEO 图片引用',async()=>{
 const db=client.database
 const snapshot={routes:[],seo:[]}
 const old=await appendConfigRelease(db,actor,1,snapshot),current=await appendConfigRelease(db,actor,1,snapshot,old.id)
 await db.update(websiteSiteConfig).set({publishedReleaseId:current.id,version:1}).where(eq(websiteSiteConfig.id,1))
 await media.replaceReferences(db,`website:config:${old.id}`,[{mediaId:assetId,field:'seo.0.ogMediaId'}])
 const body={kind:'routes' as const,version:1,publishedReleaseId:String(current.id),releaseId:String(old.id)}
 await expect(cleanupPublicationHistory(db,actor,{...body,releaseId:String(current.id)},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await cleanupPublicationHistory(db,actor,body,meta)
 expect(await configRelease(db,old.id)).toBeUndefined()
 expect(await configRelease(db,current.id)).toMatchObject({restoredFrom:null,content:snapshot})
 expect((await media.references(db,[assetId])).some(r=>r.owner===`website:config:${old.id}`)).toBe(false)
 const previous=await appendLanguageRelease(db,actor,1,defaultSiteLanguages,null),live=await appendLanguageRelease(db,actor,1,defaultSiteLanguages,previous.id)
 await db.update(websiteLanguageConfig).set({publishedReleaseId:live.id,version:1}).where(eq(websiteLanguageConfig.id,1))
 const languageBody={kind:'languages' as const,version:1,publishedReleaseId:String(live.id),releaseId:String(previous.id)}
 await expect(cleanupPublicationHistory(db,actor,{...languageBody,releaseId:String(live.id)},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 await cleanupPublicationHistory(db,actor,languageBody,meta)
 expect(await languageRelease(db,previous.id)).toBeUndefined()
 expect(await languageRelease(db,live.id)).toMatchObject({restoredFrom:null,content:defaultSiteLanguages})
})

it('历史列表与详情返回用户名，停用和软删除账号仍保留署名且不返回账号敏感资料',async()=>{
 const db=client.database
 const [root]=await db.select({username:adminUsers.username}).from(adminUsers).where(eq(adminUsers.id,actor))
 const resource=(await resources.find(db,'site.basic'))!
 const detail=await createWebsitePublishingService(db).detail(actor,resource.key,String(resource.publishedReleaseId))
 expect(detail).toMatchObject({createdBy:String(actor),createdByUsername:root!.username,createdByStatus:'active'})
 expect((await readSiteLanguageState(db,actor)).releases[0]).toMatchObject({createdByUsername:root!.username})
 expect((await readWebsiteRouteTree(db,actor)).releases[0]).toMatchObject({createdByUsername:root!.username})
 const release={id:1n,createdAt:new Date('2026-11-23T00:00:00Z'),createdBy:deniedActor,restoredFrom:null}
 await db.update(adminUsers).set({enabled:false}).where(eq(adminUsers.id,deniedActor))
 expect((await publicationMetadata(db,[release]))[0]).toMatchObject({createdByUsername:'history_denied',createdByStatus:'disabled'})
 await db.update(adminUsers).set({deletedAt:new Date()}).where(eq(adminUsers.id,deniedActor))
 const metadata=await publicationMetadata(db,[{id:1n,createdAt:new Date('2026-11-23T00:00:00Z'),createdBy:deniedActor,restoredFrom:null}])
 expect(metadata).toEqual([{id:'1',createdAt:'2026-11-23T00:00:00.000Z',createdBy:String(deniedActor),createdByUsername:'history_denied',createdByStatus:'deleted',restoredFrom:null}])
 const replacement=BigInt((await createAccountService(db,false).createOrdinary({username:'history_denied',displayName:'同名新账号',password:'History fixture Aurora mist 8462!'},String(actor))).id)
 expect(replacement).not.toBe(deniedActor)
 expect(await publicationMetadata(db,[release,{...release,id:2n,createdBy:replacement}])).toEqual([
  expect.objectContaining({createdBy:String(deniedActor),createdByUsername:'history_denied',createdByStatus:'deleted'}),
  expect.objectContaining({createdBy:String(replacement),createdByUsername:'history_denied',createdByStatus:'active'}),
 ])
 expect(await publicationMetadata(db,[])).toEqual([])
})
