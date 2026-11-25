import {readModuleImageRules} from '../../server/repositories/website-image-rules'
import {moduleImageRules} from '../../server/services/website-image-rules'
import {websiteImageRules} from '../../server/db/schema'
import {templateDefinition} from '../fixtures/reference/template-catalog';
import { setupPublishedSeo } from '../fixtures/website-seo';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3';
import { createAuthService, csrfToken } from '../../server/services/auth';
import { createRbacService } from '../../server/services/rbac';
import { newsHandlers } from '../../server/http/handlers/news-handlers';
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth';
import { getQuery, getRouterParam } from 'h3';
import { defineApiHandler, apiErrorResponse } from '../../server/http/handler';
import { ensureRequestId } from '../../server/http/request-id';
import { setupTestDatabase, cleanTestDatabase } from './support';
import { seedRoot } from '../../scripts/database/seed/system';
import { createAccountService } from '../../server/services/accounts';
import { createNewsService } from '../../server/services/news';
import { createPublicNewsService } from '../../server/services/public-news';
import { readNewsOperations, saveNewsOperations } from '../../server/services/news-operations';
import { createWebsitePublishingService } from '../../server/services/website-publishing';
import { createWebsitePageWithdrawalService } from '../../server/services/website-page-withdrawal';
import { websiteResourceRepository as website } from '../../server/repositories/website-resources';
import { websitePublishedRoutes, websitePublishedSeo, websiteResources, websiteReleases, websiteDrafts, newsArticles, adminUsers } from '../../server/db/schema';
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import { emptyNewsContent } from '../../shared/schemas/admin/news';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import {createSiteSettings,createSiteLink} from '../../shared/utils/admin/site-settings'
import { siteSettingsRepository } from '../../server/repositories/site-settings';
import { createSiteSettingsService } from '../../server/services/site-settings';
import { publicPublicationFixture } from './fixtures/public-publication';
import { auditRepository } from '../../server/repositories/audit';
import { createMediaService } from '../../server/services/media';
import { createLocalMediaStorage } from '../../server/infrastructure/media-storage';
import { taskRepository } from '../../server/repositories/tasks';
import { claimQueuedTask, enqueueTask } from '../../server/services/tasks/state';
import { executeTask } from '../../server/services/tasks/executor';
import { websiteNavigationTargets } from '../../server/services/website-navigation-targets';
let client: Awaited<ReturnType<typeof setupTestDatabase>>, actor: bigint, ordinary: bigint, service: ReturnType<typeof createNewsService>, publicService: ReturnType<typeof createPublicNewsService>, categoryId: string, pageId: bigint;
const meta = { ip: 'local', userAgent: 'news-test', requestId: '00000000-0000-4000-8000-000000000001' };
const state = (a: {
    version: number;
    stateVersion: number;
    publishedReleaseId: string | null;
}) => ({ version: a.version, stateVersion: a.stateVersion, publishedReleaseId: a.publishedReleaseId });
async function article(slug: string, category = categoryId) { const content = emptyNewsContent(category); for (const locale of siteLocales)
    content.localized[locale] = { ...content.localized[locale], title: '标题 ' + locale, summary: '摘要 ' + locale, body: [{ type: 'paragraph', text: '正文 ' + locale }] }; return service.save(actor, null, { slug, content }, meta); }
async function activatePage() {
    const definition=templateDefinition('news.list')!;
    const localized=Object.fromEntries(siteLocales.map(locale=>[locale,{copy:{all:'All',empty:'No news'},data:{pageSize:12,showFilters:true,showDate:true,showSummary:true}}]));
    const content={settings:{...emptyPageSettings(),sceneEnabled:false},sections:[{id:String(pageId),sortOrder:0,templateKey:'news.list',visible:true,anchorKey:'news-list',name:'News',shared:{media:[]},localized,renderer:definition.key,videoPath:null,allowedPages:definition.allowedPages,definition:definition.fields,mediaSlots:[]}]};
    const release=await withEntityIds(client.database,'website_releases',{resourceId:pageId,content,contentHash:'0'.repeat(64),draftVersion:1,createdBy:actor});
    await client.database.insert(websiteReleases).values(release);
    await website.activate(client.database,pageId,release.id);
    await setupPublishedSeo(client.database,String(pageId));
    await client.database.insert(websitePublishedRoutes).values({path:'/news',resourceId:pageId}).onDuplicateKeyUpdate({set:{path:'/news'}});
}
beforeAll(async () => { client = await setupTestDatabase(); actor = BigInt((await seedRoot(client.database, 'News fixture Aurora mist 8462!')).id); await client.database.update(adminUsers).set({ mustChangePassword: false }); await createRbacService(client.database).sync(actor, meta); ordinary = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'news_denied', displayName: '无新闻权限', password: 'News fixture Aurora mist 8462!' }, String(actor))).id); await client.database.update(adminUsers).set({ mustChangePassword: false }); service = createNewsService(client.database); publicService = createPublicNewsService(client.database); categoryId = (await service.categorySave(actor, null, { code: 'test', name: { zh: '测试', en: 'Test', fr: 'Test', es: 'Test', pt: 'Test' }, sortOrder: 0, enabled: true }, meta)).id; const row = await withEntityIds(client.database, 'website_resources', { key: 'page.news', type: 'page', createdBy: actor, updatedBy: actor }); await client.database.insert(websiteResources).values(row); pageId = row.id; await client.database.insert(websiteDrafts).values({ resourceId: pageId, content: emptyPageSettings(), updatedBy: actor }); await activatePage(); });
let server: Server | undefined;
afterAll(async () => { if (server)
    await new Promise<void>(resolve => server!.close(() => resolve())); if (client)
    await cleanTestDatabase(client); });
describe('新闻独立生命周期', () => {
    it('后台搜索覆盖全部资源语言，并将百分号和下划线作为普通文本', async () => {
        const content=emptyNewsContent(categoryId);
        content.localized.fr.title='Recherche unique 75%_fin';
        const a=await service.save(actor,null,{slug:'multilingual-search',content},meta);
        const other=emptyNewsContent(categoryId);
        other.localized.fr.title='Recherche unique 75XXfin';
        const b=await service.save(actor,null,{slug:'multilingual-search-other',content:other},meta);
        const matches=(await service.list(actor,{search:'Recherche unique 75%_fin'})).items.map(item=>item.id);
        expect(matches).toContain(a.id);
        expect(matches).not.toContain(b.id);
        expect((await service.list(actor,{search:'75%_absent'})).items.map(item=>item.id)).not.toContain(a.id);
    });
    it('发布和下线推进搜索任务，重建只收录已发布的新闻快照', async () => {
        const task = (await taskRepository.byCode(client.database, 'search_rebuild'))!;
        const directory = await mkdtemp(join(tmpdir(), 'studwell-search-db-'));
        vi.stubEnv('NUXT_SEARCH_STORAGE_PATH', directory);
        let detailId:bigint|undefined;
        try {
            // 搜索需要真实发布的详情路由，列表路由本身不构成文章地址。
            const detail=await withEntityIds(client.database,'website_resources',{key:'page.news_detail',type:'page',createdBy:actor,updatedBy:actor});
            await client.database.insert(websiteResources).values(detail);
            detailId=detail.id;
            const definition=templateDefinition('news.article')!;
            const content={settings:emptyPageSettings(),sections:[{id:String(detail.id),templateKey:'news.article',sortOrder:0,visible:true,anchorKey:'article',name:'News article',shared:{media:[]},localized:Object.fromEntries(siteLocales.map(locale=>[locale,{}])),renderer:definition.key,videoPath:null,allowedPages:definition.allowedPages,definition:definition.fields,mediaSlots:[]}]};
            const release=await withEntityIds(client.database,'website_releases',{resourceId:detail.id,content,contentHash:'0'.repeat(64),draftVersion:1,createdBy:actor});
            await client.database.insert(websiteReleases).values(release);
            await website.activate(client.database,detail.id,release.id);
            await setupPublishedSeo(client.database,String(detail.id));
            await client.database.insert(websitePublishedRoutes).values({path:'/news/:slug',resourceId:detail.id});
            const future = new Date(Date.now() + 3600000);
            await taskRepository.updateTask(client.database, task.id, { nextRunAt: future });
            let a = await article('search_fixture');
            expect((await taskRepository.task(client.database, task.id))!.nextRunAt).toEqual(future);
            a = await service.publish(actor, a.id, state(a), meta);
            expect((await taskRepository.task(client.database, task.id))!.nextRunAt!.getTime()).toBeLessThan(future.getTime());
            a.content.localized.en.title = 'Unpublished title';
            a = await service.save(actor, a.id, { version: a.version, slug: a.slug, content: a.content }, meta);
            const rebuild = async (whileQueued?: () => Promise<unknown>) => {
                const run = await client.database.transaction(async (tx) => enqueueTask(tx, (await taskRepository.task(tx, task.id, true))!, 'manual', actor, new Date()));
                await claimQueuedTask(client.database, task.id, 'search-test');
                await whileQueued?.();
                await executeTask(client.database, run.id, run.token, () => false);
                expect((await taskRepository.run(client.database, run.id))?.status).toBe('success');
                const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
                const index = JSON.parse(await readFile(join(directory, 'en.' + manifest.versions.en + '.json'), 'utf8'));
                return index.documents;
            };
            expect(await rebuild()).toContainEqual(expect.objectContaining({ path: '/news/search_fixture', title: '标题 en', body: '正文 en' }));
            // A different page key and path still expose the published article.
            const app = createApp(), router = createRouter();
            router.get('/api/public/news/:slug', defineApiHandler(event => publicService.detail(getRouterParam(event, 'slug'), getQuery(event))));
            app.use(router);
            const http = createServer(toNodeListener(app));
            await new Promise<void>(resolve => http.listen(0, '127.0.0.1', resolve));
            const base = 'http://127.0.0.1:' + (http.address() as AddressInfo).port;
            try {
                await client.database.update(websitePublishedRoutes).set({ path: '/stories' }).where(eq(websitePublishedRoutes.resourceId, pageId));
                await client.database.update(websitePublishedRoutes).set({path:'/stories/:slug'}).where(eq(websitePublishedRoutes.resourceId,detailId!));
                await client.database.update(websiteResources).set({ key: 'page.stories' }).where(eq(websiteResources.id, pageId));
                try {
                    const response = await fetch(base + '/api/public/news/search_fixture?locale=en');
                    expect(response.status).toBe(200);
                    expect(await response.json()).toMatchObject({ data: { slug: 'search_fixture', title: '标题 en' } });
                    expect(await rebuild()).toContainEqual(expect.objectContaining({ path: '/stories/search_fixture' }));
                    expect((await service.overview(actor))?.status).toBe('published');
                }
                finally {
                    await client.database.update(websitePublishedRoutes).set({ path: '/news' }).where(eq(websitePublishedRoutes.resourceId, pageId));
                    await client.database.update(websitePublishedRoutes).set({path:'/news/:slug'}).where(eq(websitePublishedRoutes.resourceId,detailId!));
                    await client.database.update(websiteResources).set({ key: 'page.news' }).where(eq(websiteResources.id, pageId));
                }
            }
            finally {
                await new Promise<void>(resolve => http.close(() => resolve()));
            }
            expect(await rebuild(() => service.withdraw(actor, a.id, state(a), meta))).not.toContainEqual(expect.objectContaining({ path: '/news/search_fixture' }));
            expect((await taskRepository.task(client.database, task.id))!.nextRunAt!.getTime()).toBeLessThanOrEqual(Date.now());
        }
        finally {
            if(detailId){
                await client.database.delete(websitePublishedRoutes).where(eq(websitePublishedRoutes.resourceId,detailId));
                await client.database.delete(websitePublishedSeo).where(eq(websitePublishedSeo.resourceId,detailId));
                await client.database.update(websiteResources).set({publishedReleaseId:null}).where(eq(websiteResources.id,detailId));
                await client.database.delete(websiteReleases).where(eq(websiteReleases.resourceId,detailId));
                await client.database.delete(websiteResources).where(eq(websiteResources.id,detailId));
            }
            vi.unstubAllEnvs();
            await rm(directory, { recursive: true, force: true });
        }
    });
    it('浏览量默认关闭；开启时并发累加，关闭保留累计值且读取不增加', async () => {
        const draft = await article('view-count');
        const a = await service.publish(actor, draft.id, state(draft), meta);
        expect(await publicService.recordView(a.slug)).toEqual({ viewCount: null });
        const settings = await readNewsOperations(client.database);
        await expect(saveNewsOperations(client.database, ordinary, { ...settings, viewCountEnabled: true }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        let current = await saveNewsOperations(client.database, actor, { ...settings, viewCountEnabled: true }, meta);
        await expect(saveNewsOperations(client.database, actor, { ...settings, viewCountEnabled: false }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
        try {
            expect((await publicService.detail(a.slug, { locale: 'zh' })).viewCount).toBe(0);
            const counts = await Promise.all([publicService.recordView(a.slug), publicService.recordView(a.slug)]);
            expect(counts.map(r => r.viewCount).sort()).toEqual([1, 2]);
            expect((await publicService.detail(a.slug, { locale: 'en' })).viewCount).toBe(2);
            expect((await publicService.detail(a.slug, { locale: 'zh' })).viewCount).toBe(2);
            current = await saveNewsOperations(client.database, actor, { ...current, viewCountEnabled: false }, meta);
            expect(await publicService.recordView(a.slug)).toEqual({ viewCount: null });
            expect((await publicService.detail(a.slug, {})).viewCount).toBeNull();
            current = await saveNewsOperations(client.database, actor, { ...current, viewCountEnabled: true }, meta);
            await activatePage();
            expect((await publicService.detail(a.slug, {})).viewCount).toBe(2);
            await service.withdraw(actor, a.id, state(a), meta);
            await expect(publicService.recordView(a.slug)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        }
        finally {
            await saveNewsOperations(client.database, actor, { ...current, viewCountEnabled: false }, meta);
        }
    });
    it('HTTP 默认鉴权、CSRF、严格输入和跨文章历史路径均受保护', async () => {
        const auth = createAuthService(client.database, undefined, false), rbac = createRbacService(client.database), options = { origin: 'http://news.test', secureCookie: false };
        const anonymous = await auth.bootstrap(undefined, meta), token = (await auth.login(anonymous.raw, 'root', 'News fixture Aurora mist 8462!', meta)).raw;
        const app = createApp(), router = createRouter(), handlers = newsHandlers(client.database, options);
        app.use(defineEventHandler(async (event) => { ensureRequestId(event); try {
            await guardAdminRequest(event, auth, options, rbac.authorize);
        }
        catch (error) {
            return apiErrorResponse(event, error);
        } }));
        router.get('/api/admin/news/categories', handlers.categories).put('/api/admin/news/categories', handlers.categorySave).get('/api/admin/news/articles/:id/releases/:releaseId', handlers.release);
        app.use(router);
        server = createServer(toNodeListener(app));
        await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
        const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        expect((await fetch(base + '/api/admin/news/categories')).status).toBe(401);
        const headers = { Cookie: SESSION_COOKIE + '=' + token, Origin: options.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': 'bad' };
        expect((await fetch(base + '/api/admin/news/categories', { method: 'PUT', headers, body: '{}' })).status).toBe(403);
        headers['X-CSRF-Token'] = csrfToken(token);
        expect((await fetch(base + '/api/admin/news/categories', { method: 'PUT', headers, body: '{"unexpected":true}' })).status).toBe(400);
        expect((await fetch(base + '/api/admin/news/categories', { headers })).status).toBe(200);
        const saveCategory = (value: unknown) => fetch(base + '/api/admin/news/categories', { method: 'PUT', headers, body: JSON.stringify(value) });
        const input = { id: null, code: 'http-category', name: { zh: '接口分类', en: 'HTTP', fr: 'HTTP', es: 'HTTP', pt: 'HTTP' }, sortOrder: 0, enabled: false };
        const created = await saveCategory(input);
        expect(created.status).toBe(200);
        const { data: category } = await created.json();
        const updated = await saveCategory({ ...input, id: category.id, version: category.version, name: { ...input.name, zh: '更新后的分类' } });
        expect(updated.status).toBe(200);
        expect(await updated.json()).toMatchObject({ data: { id: category.id, version: category.version + 1, name: { zh: '更新后的分类' } } });
        expect((await saveCategory({ ...input, id: category.id, version: category.version })).status).toBe(409);
        let a = await article('http-history');
        a = await service.publish(actor, a.id, state(a), meta);
        expect((await fetch(base + `/api/admin/news/articles/${a.id}/releases/${a.publishedReleaseId}`, { headers })).status).toBe(200);
        const other = await article('http-other');
        expect((await fetch(base + `/api/admin/news/articles/${other.id}/releases/${a.publishedReleaseId}`, { headers })).status).toBe(404);
    });
    it('业务数据不进入网页资源，拒绝无权限读写和未完成语言发布', async () => {
        await expect(service.list(ordinary, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(service.save(ordinary, null, { slug: 'denied', content: emptyNewsContent(categoryId) }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        const a = await service.save(actor, null, { slug: 'incomplete', content: emptyNewsContent(categoryId) }, meta);
        await expect(service.publish(actor, a.id, state(a), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect((await website.all(client.database)).map(r => r.key)).toEqual(['page.news']);
    });
    it('发布快照隔离草稿，分页分类筛选与推荐均只读当前发布版本', async () => {
        let a = await article('isolation');
        a.content.featured = true;
        a = await service.save(actor, a.id, { version: a.version, slug: a.slug, content: a.content }, meta);
        a = await service.publish(actor, a.id, state(a), meta);
        const old = await publicService.detail(a.slug, { locale: 'en' });
        expect(old.title).toBe('标题 en');
        a.content.localized.en.title = '未发布改动';
        a.content.featured = false;
        const saved = await service.save(actor, a.id, { version: a.version, slug: a.slug, content: a.content }, meta);
        expect(saved.changed).toBe(true);
        expect((await publicService.detail(a.slug, { locale: 'en' })).title).toBe(old.title);
        expect((await publicService.list({ locale: 'en', featured: 'true' })).items.map(i => i.slug)).toContain(a.slug);
        const page = await publicService.list({ category: 'test', pageSize: '1' });
        expect(page.items).toHaveLength(1);
        expect(page).toMatchObject({ locale: 'en', categories: [expect.objectContaining({ id: 'test', name: expect.any(String) })] });
        expect(await publicService.list({ category: 'test', page: '100000' })).toMatchObject({ items: [], total: page.total, page: 100000 });
        await expect(publicService.list({ category: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(publicService.detail(a.slug, { page: '1' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        await expect(service.save(actor, a.id, { version: a.version, slug: a.slug, content: a.content }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
        await expect(service.save(actor, a.id, { version: saved.version, slug: 'changed-slug', content: a.content }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
    it('恢复追加历史但保留工作草稿，跨文章历史不允许恢复，下线有状态并发检查', async () => {
        let a = await article('history');
        a = await service.publish(actor, a.id, state(a), meta);
        const first = a.publishedReleaseId!;
        a.content.localized.zh.title = '新版';
        a = await service.save(actor, a.id, { version: a.version, slug: a.slug, content: a.content }, meta);
        a = await service.publish(actor, a.id, state(a), meta);
        const restored = await service.publish(actor, a.id, { ...state(a), releaseId: first }, meta, true);
        expect(restored.content.localized.zh.title).toBe('新版');
        expect(restored.changed).toBe(true);
        expect(restored.releases).toHaveLength(3);
        expect((await publicService.detail(a.slug, {})).title).toBe('标题 en');
        const other = await article('other-history');
        await expect(service.publish(actor, other.id, { ...state(other), releaseId: first }, meta, true)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        const offline = await service.withdraw(actor, a.id, state(restored), meta);
        await expect(publicService.detail(a.slug, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(service.publish(actor, a.id, state(restored), meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
        expect(offline.releases).toHaveLength(3);
    });
    it('审计失败回滚发布记录和指针；同版本并发发布只成功一次', async () => {
        const a = await article('audit');
        const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('NEWS_AUDIT_FIXTURE'));
        try {
            await expect(service.publish(actor, a.id, state(a), meta)).rejects.toThrow('NEWS_AUDIT_FIXTURE');
        }
        finally {
            spy.mockRestore();
        }
        expect((await service.detail(actor, a.id)).releases).toHaveLength(0);
        const concurrent = await Promise.allSettled([service.publish(actor, a.id, state(a), meta), service.publish(actor, a.id, state(a), meta)]);
        expect(concurrent.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    });
    it('分类停用和删除检查已发布文章、历史与导航，导航目标来自正式分类表', async () => {
        const c = (await service.categories(actor)).find(c => c.id === categoryId)!;
        await expect(service.categorySave(actor, c.id, { ...(({ id: _id, ...rest }) => rest)(c), enabled: false }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        await expect(service.categoryDelete(actor, c.id, { version: c.version }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect((await websiteNavigationTargets(client.database)).some(t => t.key === 'news-category:news:test')).toBe(true);
    });
    it('已发布首页推荐阻止新闻下线，隐藏并发布后可下线，下线期间不能恢复推荐', async () => {
        const home = await withEntityIds(client.database, 'website_resources', { key: 'page.home', type: 'page', createdBy: actor, updatedBy: actor });
        await client.database.insert(websiteResources).values(home);
        const settings = emptyPageSettings();
        await client.database.insert(websiteDrafts).values({ resourceId: home.id, content: settings, updatedBy: actor });
        async function homeRelease(visible: boolean) {
            const content = { settings, sections: [{ templateKey: 'home.news', visible }] };
            const release = await withEntityIds(client.database, 'website_releases', { resourceId: home.id, content, contentHash: '0'.repeat(64), draftVersion: 1, createdBy: actor });
            await client.database.insert(websiteReleases).values(release);
            await website.activate(client.database, home.id, release.id);
            return release.id;
        }
        const shown = await homeRelease(true);
        const page = (await website.find(client.database, 'page.news'))!;
        const input = { version: page.draftVersion, stateVersion: page.stateVersion, publishedReleaseId: String(page.publishedReleaseId) };
        const withdrawal = createWebsitePageWithdrawalService(client.database);
        await expect(withdrawal.withdraw(actor, 'page.news', input, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'DEPENDENCY_UNAVAILABLE' });
        const hidden = await homeRelease(false);
        await client.database.delete(websitePublishedRoutes).where(eq(websitePublishedRoutes.resourceId, pageId));
        await withdrawal.withdraw(actor, 'page.news', input, meta);
        const current = (await website.find(client.database, 'page.home'))!;
        const publishing = createWebsitePublishingService(client.database);
        await expect(publishing.restore(actor, 'page.home', { version: current.draftVersion, stateVersion: current.stateVersion, publishedReleaseId: String(hidden), releaseId: String(shown) }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'DEPENDENCY_UNAVAILABLE' });
        await activatePage();
    });
    it('隐藏导航须发布后才能下线新闻页面；下线页面不关闭新闻业务或改变文章状态', async () => {
        await siteSettingsRepository.insert(client.database, createSiteSettings(), actor);
        const settings = createSiteSettingsService(client.database), publishing = publicPublicationFixture(client.database), withdrawal = createWebsitePageWithdrawalService(client.database);
        let common = await settings.read(actor);
        common.content.header.items = [{ ...createSiteLink('news'), target: { module: 'news', resourceId:String(pageId), type: 'page', value: '' }, children: [] }];
        common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
        await publishing.publish(actor, { section: 'header', version: common.versions.header, publishedReleaseId: null }, meta);
        const page = (await website.find(client.database, 'page.news'))!, input = { version: page.draftVersion, stateVersion: page.stateVersion, publishedReleaseId: String(page.publishedReleaseId) };
        await expect(withdrawal.withdraw(actor, 'page.news', input, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'PAGE_LINKED' });
        common = await settings.read(actor);
        common.content.header.items[0]!.visible = false;
        common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
        await expect(withdrawal.withdraw(actor, 'page.news', input, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
        const p = common.publication!.header;
        await publishing.publish(actor, { section: 'header', version: p.draftVersion, publishedReleaseId: p.publishedReleaseId }, meta);
        const before = (await client.database.select().from(newsArticles)).map(a => String(a.publishedReleaseId));
        await client.database.delete(websitePublishedRoutes).where(eq(websitePublishedRoutes.resourceId, pageId));
        await withdrawal.withdraw(actor, 'page.news', input, meta);
        expect((await publicService.list({})).items.length).toBeGreaterThan(0);
        await expect(publicService.list({ featured: 'true' })).resolves.toMatchObject({ items: expect.any(Array) });
        expect((await client.database.select().from(newsArticles)).map(a => String(a.publishedReleaseId))).toEqual(before);
        await activatePage();
        expect((await publicService.list({})).items.length).toBeGreaterThan(0);
    });
    it('发布文章返回直连媒体地址，草稿和发布历史保留媒体引用保护', async () => {
        const storage = createLocalMediaStorage(await mkdtemp(join(tmpdir(), 'news-media-'))), media = createMediaService(client.database, storage);
        const asset = await media.upload(actor, { name: '新闻封面测试', remark: '' }, { bytes: await readFile('tests/fixtures/media/frontend/brand/header-logo@3x.png'), filename: 'news-cover.png', mime: 'image/png' }, meta);
        let a = await article('media-reference');
        a.content.coverMediaId = asset.id;
        a.content.featured = true;
        a.content.coverPresentation = { desktop: { x: 40, y: 60, zoom: 1.2 }, mobile: { x: 50, y: 50, zoom: 1 }, opacity: .8, brightness: 1.1 };
        a.content.localized.zh.body.push({ type: 'image', image: { mediaId: asset.id, alt: '完整图片', presentation: { desktop: { x: 50, y: 50, zoom: 1 }, mobile: { x: 50, y: 50, zoom: 1 }, opacity: 1, brightness: 1 } }, caption: '' });
        a = await service.save(actor, a.id, { version: a.version, slug: a.slug, content: a.content }, meta);
        expect(a.content.coverPresentation?.desktop?.x).toBe(40);
        await expect(publicService.detail(a.slug, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
        a = await service.publish(actor, a.id, state(a), meta);
        expect((await publicService.detail(a.slug, {})).coverImage?.src).toMatch(/^\/uploads\//);
        expect((await publicService.list({ featured: 'true' })).items.map(item => item.slug)).toContain(a.slug);
        const detail = await publicService.detail(a.slug, { locale: 'zh' });
        expect(detail.coverImage?.presentation).toEqual(a.content.coverPresentation);
        expect(detail.body.filter(block => block.type === 'image').at(-1)?.image.presentation?.brightness).toBe(1);
        a = await service.withdraw(actor, a.id, state(a), meta);
        await expect(media.remove(actor, asset.id, asset.version, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'REFERENCED' });
    });
});
it('分类排序原子交换并检查双方版本，同值排序可调整，审计失败全量回滚', async () => {
    const input = { name: { zh: '排序分类', en: 'Order', fr: 'Order', es: 'Order', pt: 'Order' }, enabled: true };
    let one = await service.categorySave(actor, null, { ...input, code: 'order_one', sortOrder: 9000 }, meta), two = await service.categorySave(actor, null, { ...input, code: 'order_two', sortOrder: 9100 }, meta);
    let rows = await service.categoryMove(actor, two.id, { version: two.version, neighborId: one.id, neighborVersion: one.version, direction: 'up' }, meta);
    expect(rows.findIndex(c => c.id === two.id)).toBeLessThan(rows.findIndex(c => c.id === one.id));
    await expect(service.categoryMove(actor, two.id, { version: two.version, neighborId: one.id, neighborVersion: one.version, direction: 'down' }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
    one = rows.find(c => c.id === one.id)!;
    two = rows.find(c => c.id === two.id)!;
    one = await service.categorySave(actor, one.id, { ...(({ id: _id, ...value }) => value)(one), sortOrder: 8000 }, meta);
    two = await service.categorySave(actor, two.id, { ...(({ id: _id, ...value }) => value)(two), sortOrder: 8000 }, meta);
    rows = await service.categoryMove(actor, two.id, { version: two.version, neighborId: one.id, neighborVersion: one.version, direction: 'up' }, meta);
    expect(rows.findIndex(c => c.id === two.id)).toBeLessThan(rows.findIndex(c => c.id === one.id));
    expect(new Set(rows.map(c => c.sortOrder)).size).toBe(rows.length);
    const before = await service.categories(actor);
    one = before.find(c => c.id === one.id)!;
    two = before.find(c => c.id === two.id)!;
    const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('ORDER_AUDIT_FIXTURE'));
    try {
        await expect(service.categoryMove(actor, two.id, { version: two.version, neighborId: one.id, neighborVersion: one.version, direction: 'down' }, meta)).rejects.toThrow('ORDER_AUDIT_FIXTURE');
    }
    finally {
        spy.mockRestore();
    }
    expect(await service.categories(actor)).toEqual(before);
});

it('模块图片规则从数据库读取并收紧保存校验，未授权账号不能读取规则',async()=>{
 const before=await readModuleImageRules(client.database)
 const rules={...before,newsCover:{...before.newsCover,maxZoom:1.5}}
 await client.database.update(websiteImageRules).set({rules}).where(eq(websiteImageRules.id,1))
 try{
  expect((await moduleImageRules(client.database,actor)).newsCover.maxZoom).toBe(1.5)
  await expect(moduleImageRules(client.database,ordinary)).rejects.toMatchObject({code:'FORBIDDEN'})
  const content=emptyNewsContent(categoryId)
  content.coverPresentation={desktop:{x:50,y:50,zoom:2}}
  await expect(service.save(actor,null,{slug:'invalid-database-image-rule',content},meta)).rejects.toMatchObject({code:'INVALID_INPUT'})
 }finally{await client.database.update(websiteImageRules).set({rules:before}).where(eq(websiteImageRules.id,1))}
})
