import {readSiteLanguages} from '../../server/services/site-languages'
import {validateSiteConfig} from '../../server/services/website-route-tree'
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { mediaAssets, mediaReferences } from '../../server/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { websiteRouteNodes, websiteResources, websiteTemplates, adminUsers } from '../../server/db/schema';
import { previewArticle } from '../fixtures/previewArticle';
import { readWebsiteRouteTree, mutateWebsiteRouteNode, publishWebsiteRouteTree } from '../../server/services/website-route-tree';
import {lookupPublishedWebsiteRoute} from '../../server/repositories/website-route-tree';
import { setupTestDatabase, cleanTestDatabase } from './support';
import { seedRoot } from '../../scripts/database/seed/system';
import { seedWebsiteTemplates } from '../fixtures/reference-seed';
import { createMenuService } from '../../server/services/menus';
import { createWebsitePagesService } from '../../server/services/website-pages';
import { createWebsitePublishingService } from '../../server/services/website-publishing';
import { previewWebsitePage } from '../../server/services/website-page-preview';
import { previewNewsArticleLayout } from '../../server/services/news-article-layout-preview';
import { publicSiteSettings } from '../../server/services/public-site-settings';
import { publicWebsitePage } from '../../server/services/public-website-page';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import { auditRepository } from '../../server/repositories/audit';
let client: Awaited<ReturnType<typeof setupTestDatabase>>, actor: bigint, resourceId: string, rootId: string;
const meta = { ip: 'local', userAgent: 'website-config-test', requestId: '00000000-0000-4000-8000-000000000001' };
const tree = () => readWebsiteRouteTree(client.database, actor);
const publish = async (releaseId?: string) => { const state = await tree(); return publishWebsiteRouteTree(client.database, actor, { version: state.version, publishedReleaseId: state.publishedReleaseId, ...(releaseId ? { releaseId } : {}) }, meta); };
const edit = async (value: object) => mutateWebsiteRouteNode(client.database, actor, { version: (await tree()).version, ...value }, meta);
const seo = (title: string, ogMediaId: string | null = null, indexable = true) => edit({ action: 'seo', resourceId, entries: siteLocales.map(locale => ({ locale, title, description: 'Independent service description', indexable, ogTitle: '', ogDescription: '', ogMediaId })) });
beforeAll(async () => { client = await setupTestDatabase(); actor = BigInt((await seedRoot(client.database, 'Website route fixture Aurora 8462!')).id); await client.database.update(adminUsers).set({ mustChangePassword: false }); await seedWebsiteTemplates(client.database); });
afterAll(async () => { if (client)
    await cleanTestDatabase(client); });
it('新闻预览读取未绑定路由的已发布详情布局，包含其他区块且不混入布局草稿', async () => {
    const db=client.database, pages=createWebsitePagesService(db);
    await expect(previewNewsArticleLayout(db,actor,{locale:'en'})).rejects.toMatchObject({code:'NOT_FOUND'});
    await createMenuService(db).create(actor,{code:'website_news_detail',name:'Article layout',iconKey:'file-text',parentId:null,pageKey:'website_page',sortOrder:0,visible:true},meta);
    let page=await pages.read(actor,'news_detail');
    const templates=['content.text','news.article'].map(key=>page.templates.find(t=>t.key===key)!);
    page=await pages.settings(actor,'news_detail',{version:page.settingsVersion,settings:{...page.settings,sceneEnabled:false},removed:[],sections:templates.map((t,index)=>({id:'new_'+index,templateId:t.id,templateKey:t.key,sortOrder:index,visible:true,anchorKey:'block'+index,contentVersion:1,structureVersion:1}))},meta);
    const text=page.sections.find(s=>s.templateKey==='content.text')!;
    page=await pages.section(actor,page.key,text.id,{contentVersion:text.contentVersion,structureVersion:text.structureVersion,shared:text.shared,localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:'Published layout',body:'Surrounding content'}}]))},meta);
    await createWebsitePublishingService(db).publish(actor,page.resourceKey,{version:page.version,stateVersion:page.publication.stateVersion,publishedReleaseId:null},meta);
    const draft=page.sections.find(s=>s.templateKey==='content.text')!;
    await pages.section(actor,page.key,draft.id,{contentVersion:draft.contentVersion,structureVersion:draft.structureVersion,shared:draft.shared,localized:Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{title:'Unpublished layout',body:'Do not preview this'}}]))},meta);
    const preview=await previewNewsArticleLayout(db,actor,{locale:'en'});
    expect(preview.structure.path).toBe('');
    expect(preview.structure.sections.map(s=>s.templateKey)).toEqual(['content.text','news.article']);
    expect(preview.page.sections[0]?.content.copy).toMatchObject({title:'Published layout',body:'Surrounding content'});
    expect(preview.previewSettings?.locale).toBe('en');
    await db.update(websiteTemplates).set({previewSample:{view:preview,settings:preview.previewSettings!,article:previewArticle}}).where(eq(websiteTemplates.key,'news.article'));
    expect((await previewNewsArticleLayout(db,actor,{locale:'en'})).previewData?.article).toEqual(previewArticle);
});
it('内容发布不要求 SEO，不会隐式发布地址；独立预览可用，未路由内容不能公开读取', async () => {
    const db = client.database, menus = createMenuService(db), pages = createWebsitePagesService(db);
    await menus.create(actor, { code: 'website_services', name: '服务展示名称', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta);
    const page = await pages.read(actor, 'services'), template = page.templates.find(t => t.key === 'content.text')!;
    const saved = await pages.settings(actor, 'services', { version: page.settingsVersion, settings: { ...page.settings, displayName: Object.fromEntries(siteLocales.map(locale => [locale, '服务展示名称'])), sceneEnabled: false }, removed: [], sections: [{ id: 'new_body', templateId: template.id, templateKey: template.key, sortOrder: 0, visible: true, anchorKey: 'overview', contentVersion: 1, structureVersion: 1 }] }, meta);
    const section = saved.sections[0]!;
    const content = await pages.section(actor, 'services', section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared: section.shared, localized: Object.fromEntries(siteLocales.map(locale => [locale, { copy: { title: 'Services', body: 'Saved content' } }])) }, meta);
    resourceId = content.resourceId!;
    expect((await previewWebsitePage(db, actor, 'services', { locale: 'en' })).structure.path).toBe('');
    await createWebsitePublishingService(db).publish(actor, content.resourceKey, { version: content.version, stateVersion: content.publication.stateVersion, publishedReleaseId: null }, meta);
    const current = await servicePreview('published');
    expect(current.structure.path).toBe('');
    expect(current.page.sections[0]?.content.copy).toMatchObject({ title: 'Services', body: 'Saved content' });
    const savedSection = content.sections[0]!;
    await pages.section(actor, 'services', savedSection.id, { contentVersion: savedSection.contentVersion, structureVersion: savedSection.structureVersion, shared: savedSection.shared, localized: Object.fromEntries(siteLocales.map(locale => [locale, { copy: { title: 'Changed draft', body: 'Not published' } }])) }, meta);
    expect((await servicePreview('draft')).page.sections[0]?.content.copy).toMatchObject({ title: 'Changed draft' });
    expect((await servicePreview('published')).page.sections[0]?.content.copy).toMatchObject({ title: 'Services' });
    const originalRelease=current.page.releaseId;
    const changed=await pages.read(actor,'services');
    await createWebsitePublishingService(db).publish(actor,changed.resourceKey,{version:changed.version,stateVersion:changed.publication.stateVersion,publishedReleaseId:changed.publication.publishedReleaseId},meta);
    const before=await pages.read(actor,'services');
    const history=await previewWebsitePage(db,actor,'services',{locale:'en',mode:'history',releaseId:originalRelease});
    expect(history.page.releaseId).toBe(originalRelease);
    expect(history.page.sections[0]?.content.copy).toMatchObject({title:'Services',body:'Saved content'});
    expect((await servicePreview('published')).page.sections[0]?.content.copy).toMatchObject({title:'Changed draft'});
    expect(await pages.read(actor,'services')).toEqual(before);
    await expect(previewWebsitePage(db,actor,'news_detail',{locale:'en',mode:'history',releaseId:originalRelease})).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(previewWebsitePage(db,actor,'services',{locale:'en',mode:'history'})).rejects.toMatchObject({code:'INVALID_INPUT'});
    await expect(previewWebsitePage(db,actor,'services',{locale:'en',mode:'draft',releaseId:originalRelease})).rejects.toMatchObject({code:'INVALID_INPUT'});
    await expect(previewWebsitePage(db,actor,'services',{locale:'en',mode:'history',releaseId:originalRelease,sectionId:savedSection.id})).rejects.toMatchObject({code:'INVALID_INPUT'});
    expect((await publicSiteSettings(db, { locale: 'en' })).pages).toEqual({});
    await expect(publicWebsitePage(db, 'services', { locale: 'en' })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    function servicePreview(mode: 'draft' | 'published') {
        return previewWebsitePage(db, actor, 'services', { locale: 'en', mode });
    }
});
it('单区块预览读取所属页面的已保存版本，隐藏区块可预览且不改变整页发布状态',async()=>{
    const db=client.database,pages=createWebsitePagesService(db);
    let page=await pages.read(actor,'news_detail');
    const text=page.sections.find(section=>section.templateKey==='content.text')!;
    page=await pages.settings(actor,page.key,{version:page.settingsVersion,settings:page.settings,removed:[],sections:page.sections.map(section=>({id:section.id,templateId:section.templateId,templateKey:section.templateKey,sortOrder:section.sortOrder,visible:section.id===text.id?false:section.visible,anchorKey:section.anchorKey,contentVersion:section.contentVersion,structureVersion:section.structureVersion}))},meta);
    const savedVersion=page.version;
    const whole=await previewWebsitePage(db,actor,page.key,{locale:'en',mode:'draft'});
    expect(whole.page.sections.map(section=>section.id)).not.toContain(text.id);
    const draft=await previewWebsitePage(db,actor,page.key,{locale:'en',mode:'draft',sectionId:text.id});
    expect(draft.page.sections).toHaveLength(1);
    expect(draft.page.sections[0]?.content.copy).toMatchObject({title:'Unpublished layout'});
    expect(draft.structure.sceneEnabled).toBe(false);
    expect(draft.previewData).toEqual({});
    const published=await previewWebsitePage(db,actor,page.key,{locale:'en',mode:'published',sectionId:text.id});
    expect(published.page.sections[0]?.content.copy).toMatchObject({title:'Published layout'});
    const foreign=(await pages.read(actor,'services')).sections[0]!;
    await expect(previewWebsitePage(db,actor,page.key,{locale:'en',sectionId:foreign.id})).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(previewWebsitePage(db,actor,page.key,{locale:'en',sectionId:'new_unsaved'})).rejects.toMatchObject({code:'INVALID_INPUT'});
    const unchanged=await pages.read(actor,page.key);
    expect(unchanged.version).toBe(savedVersion);
    expect(unchanged.sections.find(section=>section.id===text.id)?.visible).toBe(false);
    expect(unchanged.publication.publishedReleaseId).toBe(page.publication.publishedReleaseId);
});
it('六层路径与 SEO 一起发布；草稿修改不影响线上，过期配置拒绝保存', async () => {
    let parentId: string | null = null;
    for (const [index, slug] of ['route-group', 'materials', 'cement', 'standards', 'europe', 'services'].entries()) {
        const state = await edit({ action: 'save', id: null, parentId, slug, targetType: index === 5 ? 'page' : 'group', resourceId: index === 5 ? resourceId : null });
        const node = state.draft.find(row => row.slug === slug)!;
        parentId = node.id;
        if (index === 0)
            rootId = node.id;
    }
    await expect(publish()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const beforeContent = await createWebsitePagesService(client.database).read(actor, 'services');
    await seo('Initial search title');
    expect((await createWebsitePagesService(client.database).read(actor, 'services')).version).toBe(beforeContent.version);
    const first = await publish();
    expect(first.published).toBe(1);
    const path = '/route-group/materials/cement/standards/europe/services';
    expect((await lookupPublishedWebsiteRoute(client.database, path))?.resourceId).toBe(BigInt(resourceId));
    const live = await publicSiteSettings(client.database, { locale: 'en' });
    expect(live.pages.services?.seo.title).toBe('Initial search title');
    expect(live.pages.services?.displayName).toBe('服务展示名称');
    const stale = await tree();
    await seo('Draft search title');
    await expect(mutateWebsiteRouteNode(client.database, actor, { action: 'delete', id: rootId, version: stale.version }, meta)).rejects.toMatchObject({ reason: 'STALE' });
    expect((await publicSiteSettings(client.database, { locale: 'en' })).pages.services?.seo.title).toBe('Initial search title');
    const root = (await tree()).draft.find(row => row.id === rootId)!;
    await edit({ action: 'save', id: root.id, parentId: root.parentId, slug: 'new-group', targetType: root.targetType, resourceId: root.resourceId });
    await publish();
    expect(await lookupPublishedWebsiteRoute(client.database, path)).toBeUndefined();
    expect((await publicSiteSettings(client.database, { locale: 'en' })).pages.services).toMatchObject({ path: path.replace('route-group', 'new-group'), seo: { title: 'Draft search title' }, displayName: '服务展示名称' });
    await publish(first.publishedReleaseId);
    expect((await publicSiteSettings(client.database, { locale: 'en' })).pages.services).toMatchObject({ path, seo: { title: 'Initial search title' } });
    expect((await tree()).seo.find(row => row.locale === 'en')?.title).toBe('Draft search title');
});
it('并发发布只有一次成功；审计失败时路径与 SEO 指针全量回滚', async () => {
    const state = await tree(), raw = { version: state.version, publishedReleaseId: state.publishedReleaseId };
    const results = await Promise.allSettled([publishWebsiteRouteTree(client.database, actor, raw, meta), publishWebsiteRouteTree(client.database, actor, raw, meta)]);
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    const before = await tree(), spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('CONFIG_AUDIT_FAILURE'));
    try {
        await expect(publish()).rejects.toThrow('CONFIG_AUDIT_FAILURE');
    }
    finally {
        spy.mockRestore();
    }
    expect((await tree()).publishedReleaseId).toBe(before.publishedReleaseId);
    expect((await tree()).releases).toEqual(before.releases);
});
it('SEO 图片由草稿及配置历史保护；禁止索引设置来自独立发布配置', async () => {
    const db = client.database, asset = await withEntityIds(db, 'media_assets', { storageKey: 'uploads/config-fixture.png', name: 'OG fixture', originalName: 'og.png', kind: 'image' as const, mime: 'image/png', size: 10, createdBy: actor, updatedBy: actor });
    await db.insert(mediaAssets).values(asset);
    await seo('Search metadata', String(asset.id), false);
    await publish();
    expect((await publicSiteSettings(db, { locale: 'en' })).pages.services?.seo.indexable).toBe(false);
    await seo('Cleared draft');
    const refs = await db.select().from(mediaReferences).where(eq(mediaReferences.mediaId, asset.id));
    expect(refs.some(row => row.owner.startsWith('website:config:'))).toBe(true);
    expect(refs.some(row => row.owner.startsWith('website:seo:'))).toBe(false);
    await publish();
    expect((await db.select().from(mediaReferences).where(eq(mediaReferences.mediaId, asset.id))).length).toBeGreaterThan(0);
});
it('根路由可以绑定任意已发布页面，不要求固定 home 编码',async()=>{
 const state=await tree()
 const snapshot={routes:[{path:'/',resourceId,routeNodeId:null}],seo:state.publishedSeo.filter(row=>row.resourceId===resourceId)}
 await expect(validateSiteConfig(client.database,snapshot,await readSiteLanguages(client.database))).resolves.toBeUndefined()
})
it('路由与 SEO 同一事务保存，失败不改变草稿和版本',async()=>{
 const before=await tree(),node=before.draft.find(row=>row.resourceId===resourceId)!
 const entries=siteLocales.map(locale=>({locale,title:'Combined draft',description:'Combined description',indexable:true,ogTitle:'',ogDescription:'',ogMediaId:null}))
 const input={action:'save',id:node.id,parentId:node.parentId,slug:node.slug,targetType:node.targetType,resourceId,seo:entries}
 await expect(edit({...input,slug:'combined-failed',seo:entries.map(row=>({...row,ogMediaId:'999999999999999999'}))})).rejects.toMatchObject({code:'INVALID_INPUT'})
 expect(await tree()).toEqual(before)
 const saved=await edit(input)
 expect(saved.version).toBe(before.version+1)
 expect(saved.seo.filter(row=>row.resourceId===resourceId).every(row=>row.title==='Combined draft')).toBe(true)
})
it('配置回滚重新检查当前目标，不能恢复已下线页面', async () => {
    const db = client.database, previous = (await tree()).publishedReleaseId!;
    // Simulate a historical target subsequently withdrawn after route removal.
    await db.update(websiteResources).set({ publishedReleaseId: null }).where(eq(websiteResources.id, BigInt(resourceId)));
    await expect(publish(previous)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await tree()).publishedReleaseId).toBe(previous);
    const root = (await tree()).draft.find(row => row.id === rootId)!;
    await db.update(websiteRouteNodes).set({ slug: 'search' }).where(eq(websiteRouteNodes.id, BigInt(root.id)));
    await expect(publish()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});
