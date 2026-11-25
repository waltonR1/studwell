import imageRules from '../fixtures/reference/image-rules'
import { eq } from 'drizzle-orm';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll,beforeAll,describe,expect,it,vi } from 'vitest';
import {sectionForms as organizationFormForms} from '../fixtures/template-forms'
const organizationForm=organizationFormForms['about.structureSection']!;
import type { CollectionField,ValueField } from '../../app/types/admin/website-section-forms';
import { beginCollectionEdit,collectionEditorRows,finishCollectionEdit } from '../../app/utils/admin/website/collection-editor';
import { editBannerImage,editImagePresentation } from '../../app/utils/admin/website/section-editors';
import { changeFormValue,valueAt } from '../../app/utils/admin/website/section-forms';
import { seedRoot } from '../../scripts/database/seed/system';
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { adminPermissions,adminRoleMenus,adminRolePermissions,adminRoles,adminUserRoles,adminUsers,mediaAssets,mediaReferences,websiteDrafts,websitePublishedRoutes,websiteReleases,websiteResources,websiteSections,websiteTemplates } from '../../server/db/schema';
import { createLocalMediaStorage } from '../../server/infrastructure/media-storage';
import { auditRepository } from '../../server/repositories/audit';
import { menuRepository } from '../../server/repositories/menus';
import { siteSettingsRepository } from '../../server/repositories/site-settings';
import { websiteResourceRepository } from '../../server/repositories/website-resources';
import { createAccountService } from '../../server/services/accounts';
import { createMenuService } from '../../server/services/menus';
import { createRbacService } from '../../server/services/rbac';
import { createSiteSettingsService } from '../../server/services/site-settings';
import { createWebsitePageDeletionService } from '../../server/services/website-page-deletion';
import { createWebsitePageWithdrawalService } from '../../server/services/website-page-withdrawal';
import { createWebsitePagesService } from '../../server/services/website-pages';
import { createWebsitePublishingService } from '../../server/services/website-publishing';
import { createWebsiteTemplatesService } from '../../server/services/website-templates';
import {createSiteSettings} from '../../shared/utils/admin/site-settings'
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import type { WebsitePageRecord } from '../../shared/types/admin/website';
import { setStatistic,setStatisticYear,type StatisticsContent } from '../fixtures/statistics-editor';
import { importWebsiteContent } from '../fixtures/website-content';
import { cleanTestDatabase,setupTestDatabase } from './support';
let client: Awaited<ReturnType<typeof setupTestDatabase>>, actor: bigint, ordinary: bigint, service: ReturnType<typeof createWebsitePagesService>, publishing: ReturnType<typeof createWebsitePublishingService>;
const meta = { ip: 'local', userAgent: 'website-test', requestId: '00000000-0000-4000-8000-000000000001' };
const payload = (p: WebsitePageRecord) => ({ version: p.settingsVersion, settings: p.settings, sections: p.sections.map(s => ({ id: s.id, templateId: s.templateId, templateKey: s.templateKey, sortOrder: s.sortOrder, visible: s.visible, anchorKey: s.anchorKey, contentVersion: s.contentVersion, structureVersion: s.structureVersion })), removed: [] });
async function saveFixtureHeroTitle(page: WebsitePageRecord, title: string) {
    const hero = page.sections.find(section => section.templateKey === 'hero.export')!;
    const localized = structuredClone(hero.localized), content = localized.zh as {
        copy: {
            title: string;
        };
    };
    content.copy.title = title;
    return service.section(actor, page.key, hero.id, { contentVersion: hero.contentVersion, structureVersion: hero.structureVersion, shared: hero.shared, localized }, meta);
}
const fixtureHeroTitle = (page: WebsitePageRecord) => (page.sections.find(section => section.templateKey === 'hero.export')!.localized.zh as {
    copy: {
        title: string;
    };
}).copy.title;
async function exposeFixtureRoutes(key: string) {
    const r = await websiteResourceRepository.find(client.database, 'page.' + key);
    if (!r?.publishedReleaseId)
        return;
    const rows=[{path:key==='home'?'/':'/'+key,resourceId:r.id}]
    for (const row of rows)
        await client.database.insert(websitePublishedRoutes).values(row).onDuplicateKeyUpdate({ set: { path: row.path } });
}
async function removeFixtureRoutes(key: string) {
    const r = await websiteResourceRepository.find(client.database, 'page.' + key);
    if (r)
        await client.database.delete(websitePublishedRoutes).where(eq(websitePublishedRoutes.resourceId, r.id));
}
const publicationInput = async (key: string, input: Record<string, unknown>) => ({ ...input, stateVersion: (await websiteResourceRepository.find(client.database, key))?.stateVersion ?? 1 });
beforeAll(async () => { client = await setupTestDatabase(); await createRbacService(client.database).sync(); actor = BigInt((await seedRoot(client.database, 'Website fixture Aurora mist 8462!')).id); await client.database.update(adminUsers).set({ mustChangePassword: false }); ordinary = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'website_denied', displayName: '无授权', password: 'Fixture Aurora mist 8462!' }, String(actor))).id); await client.database.update(adminUsers).set({ mustChangePassword: false }); service = createWebsitePagesService(client.database); publishing = createWebsitePublishingService(client.database); const mediaRoot=await mkdtemp(join(tmpdir(),'website-current-media-'));const reportRoot=await mkdtemp(join(tmpdir(),'website-current-report-')); await importWebsiteContent(client.database,createLocalMediaStorage(mediaRoot),'tests/fixtures/media',reportRoot); });
afterAll(async () => { await cleanTestDatabase(client); });
describe('统一资源及真实官网草稿导入', () => {

    it('公共三个对象独立保存发布，不复制其他模块快照', async () => {
        await siteSettingsRepository.insert(client.database, createSiteSettings(), actor);
        const settings = createSiteSettingsService(client.database);
        let s = await settings.read(actor);
        s.content.header.tagline.zh = '独立页头';
        s = await settings.update(actor, { section: 'header', version: s.versions.header, content: s.content.header }, meta);
        await publishing.publish(actor, 'site.header', await publicationInput('site.header', { version: s.versions.header, publishedReleaseId: null }), meta);
        const after = await settings.read(actor);
        expect(after.publication!.header.publishedReleaseId).not.toBeNull();
        expect(after.publication!.footer.publishedReleaseId).toBeNull();
        expect(after.versions.footer).toBe(s.versions.footer);
    });
    it('拒绝普通账号越权，拒绝跨页实例和跨对象历史', async () => {
        await expect(service.read(ordinary, 'export')).rejects.toMatchObject({ code: 'FORBIDDEN' });
        const a = await service.read(actor, 'about'), e = await service.read(actor, 'export'), s = a.sections[0]!;
        await expect(service.section(actor, 'export', s.id, { contentVersion: s.contentVersion, structureVersion: s.structureVersion, shared: s.shared, localized: s.localized }, meta)).rejects.toMatchObject({ code: 'NOT_FOUND' });
        const release = await publishing.publish(actor, 'page.export', await publicationInput('page.export', { version: e.version, publishedReleaseId: null }), meta);
        await expect(publishing.detail(actor, 'page.about', release.publishedReleaseId!)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
    it('不同实例可连续保存，同一实例冲突，装配不覆盖正文', async () => {
        const before = await service.read(actor, 'export'), a = before.sections[0]!, b = before.sections[1]!;
        const save = (s: typeof a) => service.section(actor, 'export', s.id, { contentVersion: s.contentVersion, structureVersion: s.structureVersion, shared: s.shared, localized: s.localized }, meta);
        const result = await Promise.allSettled([save(a), save(b)]);
        expect(result.every(r => r.status === 'fulfilled')).toBe(true);
        await expect(save(a)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
        const oldSettings = payload(before);
        await service.settings(actor, 'export', oldSettings, meta);
        const after = await service.read(actor, 'export');
        expect(after.sections[0]!.contentVersion).toBe(a.contentVersion + 1);
        expect(after.sections[0]!.localized).toEqual(a.localized);
    });
    it('历史不变，回滚只新增发布，不改草稿和其他对象', async () => {
        let page = await service.read(actor, 'export');
        const first = await publishing.publish(actor, 'page.export', await publicationInput('page.export', { version: page.version, publishedReleaseId: page.publication.publishedReleaseId }), meta);
        const original = await publishing.detail(actor, 'page.export', first.publishedReleaseId!);
        const snapshot = original.content as {
            sections: Array<{
                templateKey: string;
                mediaSlots: Array<{
                    key: string;
                    kind: string;
                }>;
            }>;
        };
        for (const section of snapshot.sections)
            expect(section.mediaSlots).toEqual(page.sections.find(item => item.templateKey === section.templateKey)!.definition!.mediaSlots);
        expect(first.changed).toBe(false);
        page = await saveFixtureHeroTitle(page, '新正文标题');
        const next = await publishing.publish(actor, 'page.export', await publicationInput('page.export', { version: page.version, publishedReleaseId: first.publishedReleaseId }), meta);
        const rollback = await publishing.restore(actor, 'page.export', await publicationInput('page.export', { version: page.version, publishedReleaseId: next.publishedReleaseId, releaseId: first.publishedReleaseId }), meta);
        expect(rollback.releases[0]!.restoredFrom).toBe(first.publishedReleaseId);
        expect(rollback.changed).toBe(true);
        expect(fixtureHeroTitle(await service.read(actor, 'export'))).toBe('新正文标题');
        expect((await publishing.detail(actor, 'page.export', first.publishedReleaseId!)).content).toEqual(original.content);
        expect((await service.read(actor, 'about')).publication.publishedReleaseId).toBeNull();
    });
    it('栏目多实例归属、删除检查与审计失败均有事务保护', async () => {
        const before = await service.read(actor, 'about'), request = payload(before), s = before.sections[1]!;
        const storedSections = await client.database.select().from(websiteSections);
        request.sections = request.sections.filter(x => x.id !== s.id);
        await expect(service.settings(actor, 'about', request, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('AUDIT_FIXTURE'));
        try {
            await expect(service.settings(actor, 'about', payload(before), meta)).rejects.toThrow('AUDIT_FIXTURE');
        }
        finally {
            spy.mockRestore();
        }
        expect((await service.read(actor, 'about')).settingsVersion).toBe(before.settingsVersion);
        const r = await client.database.select().from(websiteResources);
        expect(r.every(x => !x.key.startsWith('global'))).toBe(true);
        expect(await client.database.select().from(websiteSections)).toHaveLength(storedSections.length);
        expect((await client.database.select().from(websiteDrafts))).toHaveLength(12);
        expect((await client.database.select().from(websiteReleases)).length).toBeGreaterThan(3);
    });
});


it('发布先授权，仅锁本对象；无关页面写锁不阻塞网站标识发布', async () => {
    const locks = vi.spyOn(websiteResourceRepository, 'lockKeys');
    try {
        await expect(publishing.publish(ordinary, 'site.basic', await publicationInput('site.basic', { version: 1, publishedReleaseId: null }), meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
        expect(locks).not.toHaveBeenCalled();
        const common = await createSiteSettingsService(client.database).read(actor);
        let release!: () => void, ready!: () => void;
        const held = new Promise<void>(r => { release = r; }), locked = new Promise<void>(r => { ready = r; });
        const blocker = client.database.transaction(async (tx) => { await tx.select().from(websiteResources).where(eq(websiteResources.key, 'page.products')).for('update'); ready(); await held; });
        await locked;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            await Promise.race([publishing.publish(actor, 'site.basic', await publicationInput('site.basic', { version: common.versions.basic, publishedReleaseId: common.publication!.basic.publishedReleaseId }), meta), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('UNRELATED_RESOURCE_BLOCKED')), 3000); })]);
            expect(locks.mock.calls.at(-1)![1]).toEqual(['site.basic']);
        }
        finally {
            clearTimeout(timer);
            release();
            await blocker;
        }
    }
    finally {
        locks.mockRestore();
    }
});
it('导航新增引用与页面隐藏同时发布时，不会同时提交失效引用', async () => {
    const settings = createSiteSettingsService(client.database);
    let common = await settings.read(actor);
    let page = await service.read(actor, 'about');
    await publishing.publish(actor, 'page.about', await publicationInput('page.about', { version: page.version, publishedReleaseId: page.publication.publishedReleaseId }), meta);
    page = await service.read(actor, 'about');
    await exposeFixtureRoutes('about');
    const section = page.sections.find(row => row.visible && row.anchorKey)!;
    const items = [{ id: 'anchor_race', label: { zh: 'About', en: 'About', fr: 'About', es: 'About', pt: 'About' }, visible: true, target: { module: 'about', resourceId:page.resourceId!, type: 'anchor' as const, value: section.anchorKey }, children: [] }];
    common.content.header.items = [];
    common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
    await publishing.publish(actor, 'site.header', await publicationInput('site.header', { version: common.versions.header, publishedReleaseId: common.publication!.header.publishedReleaseId }), meta);
    common = await settings.read(actor);
    common.content.header.items = items;
    common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
    const change = payload(page);
    change.sections.find(row => row.id === section.id)!.visible = false;
    page = await service.settings(actor, 'about', change, meta);
    const results = await Promise.allSettled([
        publishing.publish(actor, 'site.header', await publicationInput('site.header', { version: common.versions.header, publishedReleaseId: common.publication!.header.publishedReleaseId }), meta),
        publishing.publish(actor, 'page.about', await publicationInput('page.about', { version: page.version, publishedReleaseId: page.publication.publishedReleaseId }), meta),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'INVALID_INPUT' } });
});
it('模板目录独立授权与版本更新，不修改页面正文或历史', async () => {
    const templates = createWebsiteTemplatesService(client.database);
    await expect(templates.read(ordinary)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const catalog = await templates.read(actor), template = catalog[0]!, before = await service.read(actor, 'export');
    const input = { coverMediaId: null, version: template.metadataVersion, name: template.name + '测试', description: template.description, enabledForNew: false };
    const next = await templates.update(actor, template.id, input, meta);
    expect(next.find(t => t.id === template.id)).toMatchObject({ name: input.name, metadataVersion: template.metadataVersion + 1, enabledForNew: false });
    await expect(templates.update(actor, template.id, input, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
    expect((await service.read(actor, 'export')).sections).toEqual(before.sections);
});
it('模板封面仅接受图片，维护引用并保留陈旧提交保护', async () => {
    const templates = createWebsiteTemplatesService(client.database), catalog = await templates.read(actor), template = catalog[0]!;
    const [image] = await client.database.select().from(mediaAssets).where(eq(mediaAssets.kind, 'image'));
    const [video] = await client.database.select().from(mediaAssets).where(eq(mediaAssets.kind, 'video'));
    const input = { version: template.metadataVersion, name: template.name, description: template.description, enabledForNew: template.enabledForNew, coverMediaId: String(image!.id) };
    if (video)
        await expect(templates.update(actor, template.id, { ...input, coverMediaId: String(video.id) }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const result = await templates.update(actor, template.id, input, meta), saved = result.find(t => t.id === template.id)!;
    expect(saved.coverMediaId).toBe(String(image!.id));
    expect(await client.database.select().from(mediaReferences).where(eq(mediaReferences.owner, 'website:template:' + template.id))).toMatchObject([{ mediaId: image!.id, field: 'cover' }]);
    await expect(templates.update(actor, template.id, { ...input, coverMediaId: null }, meta)).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
    await templates.update(actor, template.id, { ...input, version: saved.metadataVersion, coverMediaId: null }, meta);
    expect(await client.database.select().from(mediaReferences).where(eq(mediaReferences.owner, 'website:template:' + template.id))).toHaveLength(0);
});
it('模板有发布历史时拒绝删除，清理历史后允许删除禁用目录', async () => {
    const templates = createWebsiteTemplatesService(client.database), db = client.database;
    const registered = (await templates.read(actor)).find(template => template.definition)!;
    await expect(templates.remove(actor, registered.id, { version: registered.metadataVersion }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const historical = await withEntityIds(db, 'website_templates', { key: 'fixture.history.only', name: '历史模板', enabledForNew: false, createdBy: actor, updatedBy: actor });
    await db.insert(websiteTemplates).values(historical);
    const resource = await withEntityIds(db, 'website_resources', { key: 'page.template-history-fixture', type: 'page' as const, createdBy: actor, updatedBy: actor });
    await db.insert(websiteResources).values(resource);
    const release = await withEntityIds(db, 'website_releases', { resourceId: resource.id, draftVersion: 1, contentHash: 'b'.repeat(64), content: { sections: [{ templateKey: historical.key }] }, createdBy: actor });
    await db.insert(websiteReleases).values(release);
    await expect(templates.remove(actor,String(historical.id),{version:1},meta)).rejects.toMatchObject({code:'INVALID_INPUT'});
    expect(await db.select().from(websiteReleases).where(eq(websiteReleases.id,release.id))).toHaveLength(1);
    await db.delete(websiteReleases).where(eq(websiteReleases.id,release.id));
    const next = await templates.remove(actor, String(historical.id), { version: 1 }, meta);
    expect(next.some(template => template.key === historical.key)).toBe(false);
    expect(await db.select().from(websiteReleases).where(eq(websiteReleases.id, release.id))).toHaveLength(0);
});
it('自定义菜单打开空白页面，读取不写库；操作权限与菜单授权共同限定页面范围', async () => {
    const menus = createMenuService(client.database);
    const menu = await menus.create(actor, { code: 'layout_fixture', name: '布局测试', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta);
    const count = (await client.database.select().from(websiteResources)).length;
    const blank = await service.read(actor, 'layout_fixture');
    expect(blank).toMatchObject({ persisted: false, name: '布局测试', settings: { sceneEnabled: false }, sections: [] });
    expect((await client.database.select().from(websiteResources))).toHaveLength(count);
    expect((await menus.navigation(actor)).items.some(i => i.code === 'layout_fixture' && i.path === '/admin/website/layout_fixture')).toBe(true);
    await expect(service.read(actor, 'unknown_page')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const role = await withEntityIds(client.database, 'admin_roles', { code: 'page_scope_fixture', name: '页面权限测试' });
    await client.database.insert(adminRoles).values(role);
    await client.database.insert(adminUserRoles).values({ userId: ordinary, roleId: role.id });
    const permissions = await client.database.select().from(adminPermissions);
    await client.database.insert(adminRolePermissions).values(permissions.filter(p => ['content.pages.read', 'content.pages.update', 'content.pages.publish'].includes(p.code)).map(p => ({ roleId: role.id, permissionId: p.id })));
    await expect(service.read(ordinary, 'layout_fixture')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await client.database.insert(adminRoleMenus).values({ roleId: role.id, menuId: BigInt(menu.id) });
    expect((await service.read(ordinary, 'layout_fixture')).scopeGranted).toBe(true);
    await expect(service.read(ordinary, 'about')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(menus.create(actor, { code: 'website_layout_fixture', name: '重复页面', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});




it('页面菜单始终禁止直接删除，已发布内容需先下线才能隐藏', async () => {
    const menus = createMenuService(client.database);
    await menus.create(actor, { code: 'scene_fixture', name: 'Scene', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta);
    const blank = await service.read(actor, 'scene_fixture'), source = (await service.read(actor, 'export')).sections.find(s => s.templateKey === 'export.overviewSection')!, body = payload(blank);
    body.sections = [{ id: 'new_scene', templateId: source.templateId, templateKey: source.templateKey, sortOrder: 0, visible: true, anchorKey: 'scene-content', contentVersion: 1, structureVersion: 1 }];
    let page = await service.settings(actor, blank.key, body, meta);
    const section = page.sections[0]!;
    page = await service.section(actor, page.key, section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared: source.shared, localized: source.localized }, meta);
    await publishing.publish(actor, page.resourceKey, { version: page.version, stateVersion: page.publication.stateVersion, publishedReleaseId: null }, meta);
    const row = (await menuRepository.byCode(client.database, 'scene_fixture'))!, before = await service.read(actor, 'scene_fixture');
    await expect(menus.remove(actor, String(row.id), { version: row.version }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(menus.update(actor, String(row.id), { version: row.version, name: row.name, parentId: row.parentId ? String(row.parentId) : null, sortOrder: row.sortOrder, visible: false, iconKey: row.iconKey }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const after = await service.read(actor, 'scene_fixture');
    expect(after.sections).toEqual(before.sections);
    expect(after.publication.publishedReleaseId).toBe(before.publication.publishedReleaseId);
    const empty = await menus.create(actor, { code: 'blank_delete', name: '空白菜单', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta);
    await service.read(actor, 'blank_delete');
    await expect(menus.remove(actor, empty.id, { version: 1 }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await createWebsitePageDeletionService(client.database).remove(actor, 'blank_delete', { resourceId: null, version: 1, stateVersion: 1, publishedReleaseId: null, confirmation: 'blank_delete' }, meta);
    expect(await menuRepository.byCode(client.database, 'blank_delete')).toBeNull();
});


it('已清空区块但仍有发布历史的页面继续阻止移除', async () => {
    const menus = createMenuService(client.database), row = (await menuRepository.byCode(client.database, 'scene_fixture'))!, page = await service.read(actor, 'scene_fixture');
    const cleared = await service.settings(actor, page.key, { ...payload(page), sections: [], removed: page.sections.map(s => ({ id: s.id, contentVersion: s.contentVersion })) }, meta);
    expect(cleared.sections).toHaveLength(0);
    await expect(menus.remove(actor, String(row.id), { version: row.version }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await service.read(actor, page.key)).publication.publishedReleaseId).toBe(page.publication.publishedReleaseId);
});

it('下线保留草稿和不可变历史，重新发布及再次下线后旧状态请求失效', async () => {
    const lifecycle = createWebsitePageWithdrawalService(client.database), menus = createMenuService(client.database);
    await menus.create(actor, { code: 'lifecycle_fixture', name: '生命周期测试', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta);
    const blank = await service.read(actor, 'lifecycle_fixture'), source = (await service.read(actor, 'export')).sections.find(s => s.templateKey === 'export.overviewSection')!, body = payload(blank);
    body.settings = structuredClone((await service.read(actor, 'export')).settings);
    body.sections = [{ id: 'new_lifecycle', templateId: source.templateId, templateKey: source.templateKey, sortOrder: 0, visible: true, anchorKey: 'lifecycle-content', contentVersion: 1, structureVersion: 1 }];
    let page = await service.settings(actor, blank.key, body, meta);
    const section = page.sections[0]!;
    page = await service.section(actor, page.key, section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared: source.shared, localized: source.localized }, meta);
    const initial = { version: page.version, stateVersion: page.publication.stateVersion, publishedReleaseId: null };
    const published = await publishing.publish(actor, page.resourceKey, initial, meta), original = await publishing.detail(actor, page.resourceKey, published.publishedReleaseId!);
    const input = (p: typeof published) => ({ version: page.version, stateVersion: p.stateVersion, publishedReleaseId: p.publishedReleaseId });
    await exposeFixtureRoutes(page.key);
    const settings = createSiteSettingsService(client.database);
    let common = await settings.read(actor);
    const link = { id: 'lifecycle_link', label: { zh: '生命周期', en: 'Lifecycle', fr: 'Cycle', es: 'Ciclo', pt: 'Ciclo' }, visible: true, target: { module: page.key, resourceId:page.resourceId!, type: 'page' as const, value: '' }, children: [] };
    common.content.header.items = [link];
    common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
    const navigationRelease = await publishing.publish(actor, 'site.header', await publicationInput('site.header', { version: common.versions.header, publishedReleaseId: common.publication!.header.publishedReleaseId }), meta);
    await expect(lifecycle.withdraw(actor, page.resourceKey, input(published), meta)).rejects.toMatchObject({ reason: 'PAGE_LINKED' });
    common = await settings.read(actor);
    common.content.header.items = [];
    common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
    await publishing.publish(actor, 'site.header', await publicationInput('site.header', { version: common.versions.header, publishedReleaseId: common.publication!.header.publishedReleaseId }), meta);
    await removeFixtureRoutes(page.key);
    const offline = await lifecycle.withdraw(actor, page.resourceKey, input(published), meta);
    expect(offline).toMatchObject({ status: 'offline', publishedReleaseId: null, stateVersion: published.stateVersion + 1 });
    expect(offline.releases).toEqual(published.releases);
    common = await settings.read(actor);
    expect(common.targets.some(t => t.target.module === page.key)).toBe(false);
    await expect(publishing.restore(actor, 'site.header', await publicationInput('site.header', { version: common.versions.header, publishedReleaseId: common.publication!.header.publishedReleaseId, releaseId: navigationRelease.publishedReleaseId }), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const fresh = await service.read(actor, page.key);
    expect(fresh.sections).toEqual(page.sections);
    expect(fresh.settings).toEqual(page.settings);
    expect((await publishing.detail(actor, page.resourceKey, published.publishedReleaseId!)).content).toEqual(original.content);
    const republished = await publishing.publish(actor, page.resourceKey, input(offline), meta);
    const spy = vi.spyOn(auditRepository, 'audit').mockRejectedValueOnce(new Error('WITHDRAW_AUDIT'));
    try {
        await expect(lifecycle.withdraw(actor, page.resourceKey, input(republished), meta)).rejects.toThrow('WITHDRAW_AUDIT');
    }
    finally {
        spy.mockRestore();
    }
    expect((await service.read(actor, page.key)).publication.publishedReleaseId).toBe(republished.publishedReleaseId);
    const withdrawn = await lifecycle.withdraw(actor, page.resourceKey, input(republished), meta);
    await expect(publishing.publish(actor, page.resourceKey, initial, meta)).rejects.toMatchObject({ reason: 'STALE' });
    await publishing.publish(actor, page.resourceKey, input(withdrawn), meta);
    await expect(lifecycle.withdraw(actor, 'site.header', { version: common.versions.header, stateVersion: common.publication!.header.stateVersion, publishedReleaseId: common.publication!.header.publishedReleaseId }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(lifecycle.withdraw(ordinary, page.resourceKey, input(withdrawn), meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
it('下线与导航新增引用并发，不会提交指向已下线页面的发布导航', async () => {
    const lifecycle = createWebsitePageWithdrawalService(client.database), settings = createSiteSettingsService(client.database), page = await service.read(actor, 'lifecycle_fixture');
    let common = await settings.read(actor);
    await exposeFixtureRoutes(page.key);
    common.content.header.items = [{ id: 'lifecycle_race', label: { zh: '页面', en: 'Page', fr: 'Page', es: 'Página', pt: 'Página' }, visible: true, target: { module: page.key, resourceId:page.resourceId!, type: 'page', value: '' }, children: [] }];
    common = await settings.update(actor, { section: 'header', version: common.versions.header, content: common.content.header }, meta);
    await removeFixtureRoutes(page.key);
    const result = await Promise.allSettled([publishing.publish(actor, 'site.header', await publicationInput('site.header', { version: common.versions.header, publishedReleaseId: common.publication!.header.publishedReleaseId }), meta), lifecycle.withdraw(actor, page.resourceKey, { version: page.version, stateVersion: page.publication.stateVersion, publishedReleaseId: page.publication.publishedReleaseId }, meta)]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
});
it('永久删除拒绝越权、在线和过期请求；审计失败回滚，成功清理历史并保留媒体', async () => {
    const deletion = createWebsitePageDeletionService(client.database), withdrawal = createWebsitePageWithdrawalService(client.database);
    const key = 'purge_fixture';
    await createMenuService(client.database).create(actor, { code: key, name: '永久删除验证', iconKey: 'file-text', parentId: null, pageKey: 'website_page', sortOrder: 100, visible: true }, meta);
    const source = await service.read(actor, 'export'), blank = await service.read(actor, key), body = payload(blank);
    body.settings = structuredClone(source.settings);
    const original = source.sections.find(s => s.templateKey === 'export.overviewSection')!;
    body.sections = [{ id: 'new_purge', templateId: original.templateId, templateKey: original.templateKey, sortOrder: 0, visible: true, anchorKey: 'purge-content', contentVersion: 1, structureVersion: 1 }];
    let page = await service.settings(actor, key, body, meta);
    const section = page.sections[0]!;
    page = await service.section(actor, key, section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared: original.shared, localized: original.localized }, meta);
    const input = () => ({ resourceId: page.resourceId!, version: page.version, stateVersion: page.publication.stateVersion, publishedReleaseId: null, confirmation: key });
    await expect(deletion.remove(ordinary, key, input(), meta)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const published = await publishing.publish(actor, page.resourceKey, { version: page.version, stateVersion: page.publication.stateVersion, publishedReleaseId: null }, meta);
    page = await service.read(actor, key);
    await expect(deletion.remove(actor, key, input(), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await publishing.restore(actor, page.resourceKey, { version: page.version, stateVersion: published.stateVersion, publishedReleaseId: published.publishedReleaseId, releaseId: published.publishedReleaseId }, meta);
    page = await service.read(actor, key);
    await withdrawal.withdraw(actor, page.resourceKey, { version: page.version, stateVersion: page.publication.stateVersion, publishedReleaseId: page.publication.publishedReleaseId }, meta);
    page = await service.read(actor, key);
    await expect(deletion.remove(actor, key, { ...input(), stateVersion: page.publication.stateVersion - 1 }, meta)).rejects.toMatchObject({ reason: 'STALE' });
    const [mediaBefore] = await client.pool.query('SELECT id FROM media_assets ORDER BY id');
    const audit = auditRepository.audit, spy = vi.spyOn(auditRepository, 'audit').mockImplementation(async (tx, entry) => { if (entry.action === 'menus.delete' && entry.result === 'success')
        throw new Error('PURGE_AUDIT'); return audit(tx, entry); });
    try {
        await expect(deletion.remove(actor, key, input(), meta)).rejects.toThrow('PURGE_AUDIT');
    }
    finally {
        spy.mockRestore();
    }
    expect((await service.read(actor, key)).sections).toHaveLength(1);
    expect((await service.read(actor, key)).publication.releases).toHaveLength(2);
    await deletion.remove(actor, key, input(), meta);
    expect(await websiteResourceRepository.find(client.database, page.resourceKey)).toBeUndefined();
    expect(await menuRepository.byCode(client.database, key)).toBeNull();
    const [history] = await client.pool.query('SELECT id FROM website_releases WHERE resource_id=?', [page.resourceId]);
    expect(history).toEqual([]);
    const [references] = await client.pool.query('SELECT owner FROM media_references WHERE owner=?', [`website:section:${section.id}`]);
    expect(references).toEqual([]);
    const [mediaAfter] = await client.pool.query('SELECT id FROM media_assets ORDER BY id');
    expect(mediaAfter).toEqual(mediaBefore);
});
it('第二版内容媒体按五语言登记引用，拒绝错误类型和不存在的资产', async () => {
    const page = await service.read(actor, 'home'), section = page.sections.find(s => s.templateKey === 'home.about')!;
    const update = { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared: structuredClone(section.shared), localized: structuredClone(section.localized) };
    const refs = (value: unknown): string[] => Array.isArray(value) ? value.flatMap(refs) : value && typeof value === 'object' ? Object.entries(value).flatMap(([key, item]) => key === 'mediaId' && typeof item === 'string' ? [item] : refs(item)) : [];
    for (const locale of ['zh', 'en', 'fr', 'es', 'pt'])
        expect(refs(update.localized[locale]).length).toBeGreaterThan(0);
    const saved = await service.section(actor, 'home', section.id, update, meta), current = saved.sections.find(s => s.id === section.id)!;
    const [references] = await client.pool.query('SELECT field FROM media_references WHERE owner=?', [`website:section:${section.id}`]);
    for (const locale of ['zh', 'en', 'fr', 'es', 'pt'])
        expect((references as Array<{
            field: string;
        }>).some(r => r.field.startsWith(`localized.${locale}.`))).toBe(true);
    const replace = (value: unknown, id: string): unknown => Array.isArray(value) ? value.map(x => replace(x, id)) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === 'mediaId' ? id : replace(item, id)])) : value;
    const [videos] = await client.pool.query("SELECT id FROM media_assets WHERE kind='video' LIMIT 1");
    const video = (videos as Array<{
        id: string;
    }>)[0]!.id;
    const baseline = { contentVersion: current.contentVersion, structureVersion: current.structureVersion, shared: current.shared, localized: current.localized };
    for (const id of [String(video), '2099010124000000001'])
        await expect(service.section(actor, 'home', current.id, { ...baseline, localized: replace(current.localized, id) }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await service.read(actor, 'home')).sections.find(s => s.id === section.id)?.contentVersion).toBe(current.contentVersion);
});
it('配置表单的横幅、经营指标和组织插槽通过现有接口保存，保留实例和版本边界', async () => {
    const about = await service.read(actor, 'about'), banner = about.sections.find(section => section.templateKey === 'hero.about')!;
    const image = (banner.localized.zh as {
        data: {
            topics: Array<{
                image: {
                    mediaId: string | null;
                };
            }>;
        };
    }).data.topics[0]!.image.mediaId;
    const bannerContent = editBannerImage(banner.localized, 'zh', 0, 'banner', image, {path:'data.topics',identityPath:'slug',imagePath:'image',defaults:{labelKey:'about.heroSection.title',summaryKey:'about.heroSection.intro'}});
    const savedBanner = await service.section(actor, 'about', banner.id, { contentVersion: banner.contentVersion, structureVersion: banner.structureVersion, shared: banner.shared, localized: bannerContent }, meta);
    expect(savedBanner.sections.find(section => section.id === banner.id)).toMatchObject({ anchorKey: banner.anchorKey, contentVersion: banner.contentVersion + 1, structureVersion: banner.structureVersion, localized: bannerContent });
    const home = await service.read(actor, 'home'), statistics = home.sections.find(section => section.templateKey === 'home.statistics')!;
    const stats = setStatisticYear(setStatistic(statistics.localized, 'capacity', 456), 2026);
    const savedStats = await service.section(actor, 'home', statistics.id, { contentVersion: statistics.contentVersion, structureVersion: statistics.structureVersion, shared: statistics.shared, localized: stats }, meta);
    const currentStats = savedStats.sections.find(section => section.id === statistics.id)!;
    for (const locale of ['zh', 'en', 'fr', 'es', 'pt'] as const) {
        const value = currentStats.localized[locale] as StatisticsContent;
        expect(value.data.statistics.statistics.find(row => row.key === 'capacity')!.value).toBe(456);
        expect(value.data.statistics.statisticsReporting.year).toBe(2026);
    }
    const page = await service.read(actor, 'about'), organization = page.sections.find(section => section.templateKey === 'about.structureSection')!;
    const field = organizationForm.groups[1]!.fields[0] as CollectionField;
    const root = collectionEditorRows(organization.localized, 'zh', field)[0]!;
    const edit = beginCollectionEdit(organization.localized, 'zh', organization.definition!, field, null, root.key);
    const row = collectionEditorRows(edit.localized, 'zh', field).find(row => row.key === edit.key)!;
    for (const locale of ['zh', 'en', 'fr', 'es', 'pt'] as const)
        edit.localized = changeFormValue(edit.localized, locale, field.tree!.levels[0]!.fields[0] as ValueField, row.base, locale + ' 新节点');
    const localized = finishCollectionEdit(organization.localized, edit, organization.definition!, field);
    const savedOrganization = await service.section(actor, 'about', organization.id, { contentVersion: organization.contentVersion, structureVersion: organization.structureVersion, shared: organization.shared, localized }, meta);
    const current = savedOrganization.sections.find(section => section.id === organization.id)!;
    expect(current).toMatchObject({ anchorKey: organization.anchorKey, contentVersion: organization.contentVersion + 1, structureVersion: organization.structureVersion, localized });
    for (const locale of ['zh', 'en', 'fr', 'es', 'pt'] as const)
        expect(collectionEditorRows(current.localized, locale, field).find(row => row.key === edit.key)?.item.name).toBe(locale + ' 新节点');
});
it('递归组织关系完整保存并读回，不截断第四层以后的节点', async () => {
    const page = await service.read(actor, 'about'), section = page.sections.find(section => section.templateKey === 'about.structureSection')!;
    const localized = structuredClone(section.localized);
    for (const locale of ['zh', 'en', 'fr', 'es', 'pt'] as const) {
        type Node = {
            id: string;
            name: string;
            description?: string;
            children?: Node[];
        };
        let parent = valueAt(localized[locale], 'data.organization.organization.children.0.children.0') as Node;
        for (let depth = 0; depth < 4; depth++) {
            const node = { id: 'legacy-depth-' + depth, name: locale + ' 延伸组织', description: locale + ' 节点说明' };
            parent.children ??= [];
            parent.children.push(node);
            parent = node;
        }
    }
    const saved = await service.section(actor, 'about', section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared: section.shared, localized }, meta);
    const current = saved.sections.find(candidate => candidate.id === section.id)!;
    expect(current.localized).toEqual(localized);
    expect((await service.read(actor, 'about')).sections.find(candidate => candidate.id === section.id)!.localized).toEqual(localized);
    expect(current.contentVersion).toBe(section.contentVersion + 1);
    expect(current.structureVersion).toBe(section.structureVersion);
});


it('区块保存拒绝旧栏目名称字段', async () => {
    const page = await service.read(actor, 'about'), section = page.sections[0]!;
    await expect(service.section(actor, 'about', section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, columnLabel: { zh: '旧栏目' }, shared: section.shared, localized: section.localized }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});
it('通用图片展示配置写入区块 JSON 并随发布保留，非法效果不能覆盖草稿', async () => {
    let page = await service.read(actor, 'sustainability');
    let hero = page.sections.find(section => section.templateKey === 'hero.column')!;
    const presentation = { desktop: { x: 45, y: 80, zoom: 1.5 }, opacity: .65, brightness: 1.1 };
    const localized = editImagePresentation(hero.localized, 'zh', 'data.topics.0.image', imageRules['column-banner'], presentation);
    const input = { contentVersion: hero.contentVersion, structureVersion: hero.structureVersion, shared: hero.shared, localized };
    const invalid = structuredClone(localized);
    (valueAt(invalid.zh, 'data.topics.0.image.presentation') as {
        opacity: number;
    }).opacity = 5;
    await expect(service.section(actor, page.key, hero.id, { ...input, localized: invalid }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await service.section(actor, page.key, hero.id, input, meta);
    page = await service.read(actor, page.key);
    hero = page.sections.find(section => section.id === hero.id)!;
    expect(valueAt(hero.localized.zh, 'data.topics.0.image.presentation')).toEqual(presentation);
    for (const locale of siteLocales.filter(locale => locale !== 'zh'))
        expect(hero.localized[locale]).toEqual(localized[locale]);
    const release = await publishing.publish(actor, page.resourceKey, await publicationInput(page.resourceKey, { version: page.version, publishedReleaseId: page.publication.publishedReleaseId }), meta);
    const history = await publishing.detail(actor, page.resourceKey, release.publishedReleaseId!);
    const section = (history.content as {
        sections: Array<{
            id: string;
            localized: unknown;
        }>;
    }).sections.find(section => section.id === hero.id)!;
    expect(valueAt(section.localized, 'zh.data.topics.0.image.presentation')).toEqual(presentation);
});
it('共享媒体槽的图片设置独立保存并完整进入发布快照', async () => {
    let page = await service.read(actor, 'sustainability');
    let section = page.sections.find(section => section.templateKey === 'sustainability.greenSection')!;
    const shared = structuredClone(section.shared);
    shared.media[0]!.presentation = { desktop: { x: 35, y: 70, zoom: 1.4 }, mobile: { x: 60, y: 50, zoom: 1.1 }, opacity: .8, brightness: 1.2 };
    await service.section(actor, page.key, section.id, { contentVersion: section.contentVersion, structureVersion: section.structureVersion, shared, localized: section.localized }, meta);
    page = await service.read(actor, page.key);
    section = page.sections.find(item => item.id === section.id)!;
    expect(section.shared.media[0]!.presentation).toEqual(shared.media[0]!.presentation);
    const published = await publishing.publish(actor, page.resourceKey, await publicationInput(page.resourceKey, { version: page.version, publishedReleaseId: page.publication.publishedReleaseId }), meta);
    const history = await publishing.detail(actor, page.resourceKey, published.publishedReleaseId!);
    const snapshot = (history.content as {
        sections: Array<{
            id: string;
            shared: unknown;
        }>;
    }).sections.find(item => item.id === section.id)!;
    expect(snapshot.shared).toEqual(shared);
});
