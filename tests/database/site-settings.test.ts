import {emptySiteText} from '../../shared/utils/admin/site-settings'
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import { websiteResourceRepository } from '../../server/repositories/website-resources';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createRouter, defineEventHandler, toNodeListener } from 'h3';
import { siteSettingsHandlers } from '../../server/http/handlers/site-settings-handlers';
import { guardAdminRequest, SESSION_COOKIE } from '../../server/http/auth';
import { ensureRequestId } from '../../server/http/request-id';
import { apiErrorResponse } from '../../server/http/handler';
import { createAuthService, csrfToken } from '../../server/services/auth';
import { createRbacService } from '../../server/services/rbac';
import { eq } from 'drizzle-orm';
import { setupTestDatabase, cleanTestDatabase } from './support';
import { seedRoot } from '../../scripts/database/seed/system';
import { createAccountService } from '../../server/services/accounts';
import { publicPublicationFixture } from './fixtures/public-publication';
import { websiteResourceHandlers } from '../../server/http/handlers/website-resource-handlers';
import { createSiteSettingsService } from '../../server/services/site-settings';
import { createMediaService } from '../../server/services/media';
import { createLocalMediaStorage } from '../../server/infrastructure/media-storage';
import { auditRepository } from '../../server/repositories/audit';
import { websitePublishedRoutes, adminUsers, adminOperationLogs, websiteNavigation, websiteResources } from '../../server/db/schema';
import {createSiteSettings,createSiteLink} from '../../shared/utils/admin/site-settings'
let client: Awaited<ReturnType<typeof setupTestDatabase>>, root: bigint, ordinary: bigint;
let service: ReturnType<typeof createSiteSettingsService>, media: ReturnType<typeof createMediaService>;
let server: Server, base: string, token: string;
const options = { origin: 'http://site-settings.test', secureCookie: false };
const meta = { ip: '127.0.0.1', userAgent: 'site-settings-test', requestId: '00000000-0000-4000-8000-000000000001' };
beforeAll(async () => {
    client = await setupTestDatabase();
    root = BigInt((await seedRoot(client.database, 'Site fixture Aurora 8462!')).id);
    ordinary = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'site_no_access', displayName: '普通账号', password: 'Site fixture Aurora 8462!' }, String(root))).id);
    await client.database.update(adminUsers).set({ mustChangePassword: false });
    const directory = await mkdtemp(join(tmpdir(), 'studwell-site-settings-'));
    service = createSiteSettingsService(client.database);
    media = createMediaService(client.database, createLocalMediaStorage(directory));
    const auth = createAuthService(client.database, undefined, false), rbac = createRbacService(client.database);
    const anonymous = await auth.bootstrap(undefined, meta);
    token = (await auth.login(anonymous.raw, 'root', 'Site fixture Aurora 8462!', meta)).raw;
    const app = createApp(), router = createRouter(), handlers = siteSettingsHandlers(client.database, options);
    app.use(defineEventHandler(async (event) => { ensureRequestId(event); try {
        await guardAdminRequest(event, auth, options, rbac.authorize);
    }
    catch (error) {
        return apiErrorResponse(event, error);
    } }));
    const resourceHandlers = websiteResourceHandlers(client.database, options);
    router.get('/api/admin/website-resources/:key/releases/:id', resourceHandlers.read);
    router.get('/api/admin/site-settings', handlers.read).put('/api/admin/site-settings', handlers.update);
    router.post('/api/admin/website-resources/:key/publish', resourceHandlers.publish).post('/api/admin/website-resources/:key/restore', resourceHandlers.restore);
    app.use(router);
    server = createServer(toNodeListener(app));
    // 端口由系统分配；仅在 fetch 明确禁止该端口时重新申请。
    for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        try {
            await fetch(base + '/api/admin/site-settings');
            break;
        }
        catch (error) {
            if ((error as {
                cause?: {
                    message?: string;
                };
            }).cause?.message !== 'bad port')
                throw error;
        }
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
    if (!server.listening)
        throw new Error('HTTP_TEST_PORT_UNAVAILABLE');
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { if (server)
    await new Promise<void>(resolve => server.close(() => resolve())); if (client)
    await cleanTestDatabase(client); });
describe('公共资料关系存储与分区保存', () => {
    it('空配置只读无副作用，未授权账号不能读写', async () => {
        expect((await service.read(root)).versions).toEqual({ basic: 0, header: 0, footer: 0 });
        await expect(service.read(ordinary)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(service.update(ordinary, { section: 'basic', version: 0, content: createSiteSettings().basic }, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('同分区并发首次保存只成功一次，旧版本不能覆盖', async () => {
        const content = createSiteSettings().basic;
        const results = await Promise.allSettled([service.update(root, { section: 'basic', version: 0, content }, meta), service.update(root, { section: 'basic', version: 0, content }, meta)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'CONFLICT' } });
        await expect(service.update(root, { section: 'basic', version: 0, content }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
    });
    it('不同分区可按各自版本保存，互不覆盖', async () => {
        const current = await service.read(root);
        current.content.header.tagline.zh = '页头说明';
        current.content.footer.description.zh = '页脚简介';
        const results = await Promise.allSettled([service.update(root, { section: 'header', version: current.versions.header, content: current.content.header }, meta), service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta)]);
        expect(results.every(result => result.status === 'fulfilled')).toBe(true);
        const next = await service.read(root);
        expect(next.content.header.tagline.zh).toBe('页头说明');
        expect(next.content.footer.description.zh).toBe('页脚简介');
        expect(next.versions.basic).toBe(current.versions.basic);
    });
    it('页脚简介与联系方式同一次保存并使用同一版本', async () => {
        const current = await service.read(root);
        current.content.footer.contacts=[{id:'phone',kind:'phone',label:emptySiteText(),value:{...emptySiteText(),zh:'+86 123 4567',pt:'+351 123 456'},visible:true},{id:'address',kind:'text',label:emptySiteText(),value:{...emptySiteText(),fr:'Adresse'},visible:true}];
        current.content.footer.description.zh = '完整页脚草稿';
        const next = await service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta);
        expect(next.content.footer).toEqual(current.content.footer);
        expect(next.versions.footer).toBe(current.versions.footer + 1);
    });
    it('图片引用不受其他分区保存影响，解除后才能删除', async () => {
        const bytes = await readFile('tests/fixtures/media/frontend/brand/header-logo@3x.png');
        const asset = await media.upload(root, { name: '站点 Logo', remark: '' }, { bytes, filename: 'logo.png', mime: 'image/png' }, meta);
        const current = await service.read(root);
        current.content.basic.logoId = asset.id;
        current.content.basic.logoPresentation = { desktop: { x: 50, y: 50, zoom: 1.2 }, mobile: { x: 50, y: 50, zoom: 1 }, opacity: .9, brightness: 1.1 };
        await service.update(root, { section: 'basic', version: current.versions.basic, content: current.content.basic }, meta);
        expect((await service.read(root)).content.basic.logoPresentation).toEqual(current.content.basic.logoPresentation);
        await service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta);
        await expect(media.remove(root, asset.id, asset.version, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'REFERENCED' });
        const latest = await service.read(root);
        latest.content.basic.logoId = null;
        await service.update(root, { section: 'basic', version: latest.versions.basic, content: latest.content.basic }, meta);
        await media.remove(root, asset.id, asset.version, meta);
    });
    it('任意页面入口可挂子链接，导航重排保留记录编号', async () => {
        for (const key of ['home', 'export', 'products']) {
            const row = await withEntityIds(client.database, 'website_resources', { key: `page.${key}`, type: 'page', createdBy: root, updatedBy: root });
            await client.database.insert(websiteResources).values(row);
            const release = await websiteResourceRepository.append(client.database, { resourceId: row.id, draftVersion: 1, content: { settings: emptyPageSettings(), sections: key === 'export' ? [{ anchorKey: 'export-overview', name: '业务概况', visible: true }] : [] }, createdBy: root });
            await websiteResourceRepository.activate(client.database, row.id, release.id);
            await client.database.insert(websitePublishedRoutes).values({ path: key === 'home' ? '/' : '/' + key, resourceId: row.id });
        }
        const current = await service.read(root);
        const first = { ...createSiteLink('export'), target: { module: 'export', resourceId:current.targets.find(t=>t.target.module==='export')!.resourceId, type: 'page' as const, value: '' }, children: [{ ...createSiteLink('overview'), target: { module: 'export', resourceId:current.targets.find(t=>t.target.module==='export')!.resourceId, type: 'anchor' as const, value: 'export-overview' } }] };
        const second = { ...createSiteLink('products'), target: { module: 'products', resourceId:current.targets.find(t=>t.target.module==='products')!.resourceId, type: 'page' as const, value: '' }, children: [createSiteLink('product_child')] };
        second.children[0]!.target = { ...first.target };
        current.content.header.items = [first, second];
        const saved = await service.update(root, { section: 'header', version: current.versions.header, content: current.content.header }, meta);
        const before = await client.database.select().from(websiteNavigation);
        const exportTarget=saved.content.header.items[0]!.target;
        expect(exportTarget.type!=='custom'&&exportTarget.resourceId).toBeTruthy();
        expect(before.find(node=>node.code==='export')?.targetResourceId?.toString()).toBe(exportTarget.type!=='custom'?exportTarget.resourceId:undefined);
        saved.content.header.items.reverse();
        const reordered = await service.update(root, { section: 'header', version: saved.versions.header, content: saved.content.header }, meta);
        const after = await client.database.select().from(websiteNavigation);
        expect(after.map(item => String(item.id)).sort()).toEqual(before.map(item => String(item.id)).sort());
        expect(reordered.content.header.items.map(item => item.id)).toEqual(['products', 'export']);
        reordered.content.header.items = [];
        await service.update(root, { section: 'header', version: reordered.versions.header, content: reordered.content.header }, meta);
        expect(await client.database.select().from(websiteNavigation)).toHaveLength(0);
        expect(await client.database.select().from(websiteNavigation)).toHaveLength(0);
    });
    it('无效媒体和未知目标拒绝保存；审计失败回滚全部关系记录', async () => {
        const current = await service.read(root), invalid = structuredClone(current.content.basic);
        invalid.logoId = '1';
        await expect(service.update(root, { section: 'basic', version: current.versions.basic, content: invalid }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        const wrong = { ...createSiteLink('unknown'), target: { module: 'missing', resourceId:'1', type: 'page', value: '' }, children: [] };
        await expect(service.update(root, { section: 'header', version: current.versions.header, content: { ...current.content.header, items: [wrong] } }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('AUDIT_FIXTURE'));
        try {
            await expect(service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta)).rejects.toThrow('AUDIT_FIXTURE');
        }
        finally {
            spy.mockRestore();
        }
        expect((await service.read(root)).versions).toEqual(current.versions);
        const logs = await client.database.select().from(adminOperationLogs).where(eq(adminOperationLogs.action, 'site_settings.update'));
        expect(logs.some(log => log.changeContext?.fields.some(field => field.field === 'settingsSection'))).toBe(true);
    });
    it('HTTP 拒绝匿名、无 CSRF、整站覆盖、未知字段和超限请求', async () => {
        const headers = { Cookie: `${SESSION_COOKIE}=${token}`, Origin: options.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken(token) };
        expect((await fetch(base + '/api/admin/site-settings')).status).toBe(401);
        const current = await service.read(root), payload = { section: 'footer', version: current.versions.footer, content: current.content.footer }, body = JSON.stringify(payload);
        expect((await fetch(base + '/api/admin/site-settings', { method: 'PUT', headers: { ...headers, 'X-CSRF-Token': 'bad' }, body })).status).toBe(403);
        for (const invalid of [{ ...payload, published: true }, { version: 1, content: current.content }])
            expect((await fetch(base + '/api/admin/site-settings', { method: 'PUT', headers, body: JSON.stringify(invalid) })).status).toBe(400);
        expect((await fetch(base + '/api/admin/site-settings', { method: 'PUT', headers, body: ' '.repeat(256 * 1024 + 1) })).status).toBe(413);
        const response = await fetch(base + '/api/admin/site-settings', { method: 'PUT', headers, body });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, data: { versions: { footer: current.versions.footer + 1 } } });
    });
});
describe('模块独立发布与回滚', () => {
    it('页头与页脚独立发布、历史隔离，回滚不影响另一模块或任何草稿', async () => {
        const publishing = publicPublicationFixture(client.database);
        expect(await publishing.published()).toBeNull();
        const before = await service.read(root), original = structuredClone(before.content);
        const headerInput = { section: 'header', version: before.versions.header, publishedReleaseId: null };
        const footerInput = { section: 'footer', version: before.versions.footer, publishedReleaseId: null };
        await expect(publishing.publish(ordinary, footerInput, meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(publishing.publish(root, { version: 1, publishedReleaseId: null }, meta)).rejects.toThrow();
        const [header, footer] = await Promise.all([publishing.publish(root, headerInput, meta), publishing.publish(root, footerInput, meta)]);
        expect((await service.read(root)).publication!.basic.publishedReleaseId).toBeNull();
        expect(await publishing.published()).toEqual({ header: original.header, footer: original.footer });
        const id = footer.publishedReleaseId!;
        expect(await publishing.detail(root, { section: 'footer', releaseId: id })).toMatchObject({ section: 'footer', isCurrent: true, content: { footer: original.footer } });
        await expect(publishing.detail(root, { section: 'header', releaseId: id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(publishing.restore(root, { section: 'header', version: header.draftVersion, publishedReleaseId: header.publishedReleaseId, releaseId: id }, meta)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(publishing.detail(ordinary, { section: 'footer', releaseId: id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        await expect(publishing.detail(root, { section: 'footer', releaseId: '2026010117000000999' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        const url = base + '/api/admin/website-resources/site.footer/releases/' + id;
        expect((await fetch(url)).status).toBe(401);
        const headers = { Cookie: SESSION_COOKIE + '=' + token };
        const response = await fetch(url, { headers });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(await response.json()).toMatchObject({ success: true, data: { content: original.footer } });
        expect((await fetch(url + '?extra=1', { headers })).status).toBe(400);
        expect((await fetch(base + '/api/admin/website-resources/site.footer/releases/bad', { headers })).status).toBe(403);
        let current = await service.read(root);
        current.content.footer.description.zh = '新页脚';
        current = await service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta);
        const footerPublish = { section: 'footer', version: current.versions.footer, publishedReleaseId: id };
        current.content.header.tagline.zh = '未发布页头';
        current = await service.update(root, { section: 'header', version: current.versions.header, content: current.content.header }, meta);
        const next = await publishing.publish(root, footerPublish, meta);
        await expect(publishing.publish(root, footerPublish, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
        const restored = await publishing.restore(root, { ...footerPublish, publishedReleaseId: next.publishedReleaseId, releaseId: id }, meta);
        expect(restored.releases[0]!.restoredFrom).toBe(id);
        expect(await publishing.published()).toEqual({ header: original.header, footer: original.footer });
        const after = await service.read(root);
        expect(after.content).toEqual(current.content);
        expect(after.publication!.header.publishedReleaseId).toBe(header.publishedReleaseId);
        expect(after.publication!.header.releases.map(r => r.id)).toEqual([header.publishedReleaseId]);
        expect(after.publication!.footer.releases.map(r => r.id)).not.toContain(header.publishedReleaseId);
        expect((await publishing.detail(root, { section: 'footer', releaseId: id })).content).toEqual({ footer: original.footer });
        expect((await publishing.detail(root, { section: 'footer', releaseId: id })).isCurrent).toBe(false);
    });
    it('发布审计失败回滚；HTTP 发布沿用 CSRF', async () => {
        const publishing = publicPublicationFixture(client.database), current = await service.read(root), p = current.publication!.footer;
        const input = { section: 'footer', version: p.draftVersion, publishedReleaseId: p.publishedReleaseId };
        const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('PUBLISH_AUDIT_FIXTURE'));
        try {
            await expect(publishing.publish(root, input, meta)).rejects.toThrow('PUBLISH_AUDIT_FIXTURE');
        }
        finally {
            spy.mockRestore();
        }
        expect((await service.read(root)).publication).toEqual(current.publication);
        const { websiteResourceRepository } = await import('../../server/repositories/website-resources');
        const conflict = vi.spyOn(websiteResourceRepository, 'append').mockRejectedValueOnce(Object.assign(new Error('LOCK_FIXTURE'), { code: 'ER_LOCK_DEADLOCK' }));
        try {
            await expect(publishing.publish(root, input, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'RETRY' });
        }
        finally {
            conflict.mockRestore();
        }
        expect((await service.read(root)).publication).toEqual(current.publication);
        const headers = { Cookie: SESSION_COOKIE + '=' + token, Origin: options.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': 'bad' };
        expect((await fetch(base + '/api/admin/website-resources/site.footer/publish', { method: 'POST', headers, body: JSON.stringify(input) })).status).toBe(403);
    });
    it('网站标识发布历史保护图片，页脚发布不复制其他模块图片', async () => {
        const publishing = publicPublicationFixture(client.database);
        const asset = await media.upload(root, { name: '发布版本图片', remark: '' }, { bytes: await readFile('tests/fixtures/media/frontend/brand/header-logo@3x.png'), filename: 'release.png', mime: 'image/png' }, meta);
        let current = await service.read(root);
        current.content.basic.logoId = asset.id;
        current = await service.update(root, { section: 'basic', version: current.versions.basic, content: current.content.basic }, meta);
        const p = current.publication!.basic;
        await publishing.publish(root, { section: 'basic', version: p.draftVersion, publishedReleaseId: p.publishedReleaseId }, meta);
        current = await service.read(root);
        current.content.basic.logoId = null;
        await service.update(root, { section: 'basic', version: current.versions.basic, content: current.content.basic }, meta);
        await expect(media.remove(root, asset.id, asset.version, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'REFERENCED' });
    });
});
it('自定义导航地址可保存为草稿并发布', async () => {
    const publishing = publicPublicationFixture(client.database);
    let current = await service.read(root);
    const target = { type: 'custom' as const, value: 'https://example.com/contact?source=' + 'a'.repeat(150) };
    current.content.header.items = [{ id: 'external', label: { zh: '外部网站', en: '', fr: '', es: '', pt: '' }, target, visible: true, children: [] }];
    current = await service.update(root, { section: 'header', version: current.versions.header, content: current.content.header }, meta);
    expect((await service.read(root)).content.header.items[0]?.target).toEqual(target);
    const p = current.publication!.header;
    await publishing.publish(root, { section: 'header', version: p.draftVersion, publishedReleaseId: p.publishedReleaseId }, meta);
    expect((await publishing.published()).header?.items[0]?.target).toEqual(target);
});
it('页脚联系区链接保存、发布、引用保护和清空均使用真实导航记录', async () => {
    const { websitePageRepository } = await import('../../server/repositories/website-pages');
    const { publishedPageReferences } = await import('../../server/services/website-navigation-references');
    const row = await withEntityIds(client.database, 'website_resources', { key: 'page.contact', type: 'page', createdBy: root, updatedBy: root });
    await client.database.insert(websiteResources).values(row);
    const release = await websiteResourceRepository.append(client.database, { resourceId: row.id, draftVersion: 1, content: { settings: emptyPageSettings(), sections: [] }, createdBy: root });
    await websiteResourceRepository.activate(client.database, row.id, release.id);
    await client.database.insert(websitePublishedRoutes).values({ path: '/contact', resourceId: row.id });
    let current = await service.read(root);
    const groups = structuredClone(current.content.footer.groups);
    current.content.footer.contactTarget = { module: 'missing', resourceId:'1', type: 'page', value: '' };
    await expect(service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    current.content.footer.contactTarget = { module: 'contact', resourceId:String(row.id), type: 'page', value: '' };
    current = await service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta);
    expect(current.content.footer.contactTarget).toEqual({ module: 'contact', resourceId:String(row.id), type: 'page', value: '' });
    const [storedContact]=await client.database.select().from(websiteNavigation).where(eq(websiteNavigation.code,'contact_heading'));
    expect(storedContact?.targetResourceId).toBe(row.id);
    expect(current.content.footer.groups).toEqual(groups);
    expect((await websitePageRepository.removalState(client.database, row.id, 'contact')).hasNavigation).toBe(true);
    const publishing = publicPublicationFixture(client.database), p = current.publication!.footer;
    const published = await publishing.publish(root, { section: 'footer', version: p.draftVersion, publishedReleaseId: p.publishedReleaseId }, meta);
    expect(await publishedPageReferences(client.database, 'contact')).toEqual(['footer']);
    expect((await publishing.detail(root, { section: 'footer', releaseId: published.publishedReleaseId })).content.footer!.contactTarget).toEqual(current.content.footer.contactTarget);
    current = await service.read(root);
    current.content.footer.contactTarget = null;
    current = await service.update(root, { section: 'footer', version: current.versions.footer, content: current.content.footer }, meta);
    expect(current.content.footer.contactTarget).toBeNull();
    expect((await websitePageRepository.removalState(client.database, row.id, 'contact')).hasNavigation).toBe(false);
    expect(await publishedPageReferences(client.database, 'contact')).toEqual(['footer']);
    const latest = current.publication!.footer;
    await publishing.publish(root, { section: 'footer', version: latest.draftVersion, publishedReleaseId: latest.publishedReleaseId }, meta);
    expect(await publishedPageReferences(client.database, 'contact')).toEqual([]);
});
