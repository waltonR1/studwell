import { afterAll, beforeAll, expect, it } from 'vitest';
import { setupTestDatabase, cleanTestDatabase } from './support';
import { seedRoot } from '../../scripts/database/seed/system';
import { seedWebsiteTemplates } from '../fixtures/reference-seed';
import { createRbacService } from '../../server/services/rbac';
import { createMenuService } from '../../server/services/menus';
import { createWebsitePagesService } from '../../server/services/website-pages';
import { createWebsitePublishingService } from '../../server/services/website-publishing';
import { createWebsitePageWithdrawalService } from '../../server/services/website-page-withdrawal';
import { createWebsitePageDeletionService } from '../../server/services/website-page-deletion';
import { adminUsers, adminRoles, adminUserRoles } from '../../server/db/schema';
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { createAccountService } from '../../server/services/accounts';
import { setRoleMenus, setRolePermissions } from './authorization-fixture';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import { menuRepository } from '../../server/repositories/menus';
let client: Awaited<ReturnType<typeof setupTestDatabase>>, actor: bigint;
const meta = { ip: 'local', userAgent: 'menu-lifecycle-test', requestId: '00000000-0000-4000-8000-000000000001' };
beforeAll(async () => {
    client = await setupTestDatabase();
    actor = BigInt((await seedRoot(client.database, 'Menu lifecycle Aurora 8462!')).id);
    await client.database.update(adminUsers).set({ mustChangePassword: false });
    await createRbacService(client.database).sync();
    await seedWebsiteTemplates(client.database);
});
afterAll(async () => { if (client)
    await cleanTestDatabase(client); });
const menus = () => createMenuService(client.database);
const pages = () => createWebsitePagesService(client.database);
const publication = (p: Awaited<ReturnType<ReturnType<typeof pages>['read']>>) => ({ version: p.version, stateVersion: p.publication.stateVersion, publishedReleaseId: p.publication.publishedReleaseId });
const menuUpdate = (row: Awaited<ReturnType<ReturnType<typeof menus>['list']>>[number], extra: object) => ({ version: row.version, name: row.name, iconKey: row.iconKey, parentId: row.parentId, visible: row.visible, sortOrder: row.sortOrder, ...extra });
async function makePage(key: string, parentId: string | null = null) {
    const menu = await menus().create(actor, { code: key, name: key, iconKey: 'file-text', pageKey: 'website_page', visible: true, parentId, sortOrder: 0 }, meta);
    let p = await pages().read(actor, key);
    const t = p.templates.find(t => t.key === 'content.text')!;
    p = await pages().settings(actor, key, { version: p.settingsVersion, settings: { ...p.settings, sceneEnabled: false }, sections: [{ id: 'new_body', templateId: t.id, templateKey: t.key, visible: true, sortOrder: 0, anchorKey: 'body', contentVersion: 1, structureVersion: 1 }], removed: [] }, meta);
    const s = p.sections[0]!;
    p = await pages().section(actor, key, s.id, { contentVersion: s.contentVersion, structureVersion: s.structureVersion, shared: s.shared, localized: Object.fromEntries(siteLocales.map(l => [l, { copy: { title: key, body: key } }])) }, meta);
    return { menu, page: p };
}
it('页面可作为父菜单，已发布后代阻止隐藏祖先和移入隐藏目录', async () => {
    const parent = await makePage('stagea_parent');
    const child = await makePage('stagea_child', parent.menu.id);
    const publishing = createWebsitePublishingService(client.database);
    await publishing.publish(actor, child.page.resourceKey, publication(child.page), meta);
    let rows = await menus().list(actor);
    expect(rows.find(row => row.id === parent.menu.id)?.hideDisabledReason).toContain('stagea_child');
    expect(rows.find(row => row.id === child.menu.id)?.deleteDisabledReason).toContain('页面维护');
    for (const id of [parent.menu.id, child.menu.id]) {
        const row = rows.find(row => row.id === id)!;
        await expect(menus().update(actor, id, menuUpdate(row, { visible: false }), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        await expect(menus().remove(actor, id, { version: row.version }, meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    }
    const hidden = await menus().create(actor, { code: 'stagea_hidden', name: 'Hidden', iconKey: 'folder', parentId: null, pageKey: null, visible: false, sortOrder: 0 }, meta);
    const row = rows.find(row => row.id === child.menu.id)!;
    await expect(menus().update(actor, row.id, menuUpdate(row, { parentId: hidden.id }), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const fresh = await pages().read(actor, 'stagea_child');
    await createWebsitePageWithdrawalService(client.database).withdraw(actor, fresh.resourceKey, publication(fresh), meta);
    rows = await menus().list(actor);
    const parentRow = rows.find(row => row.id === parent.menu.id)!;
    await menus().update(actor, parentRow.id, menuUpdate(parentRow, { visible: false }), meta);
    const offline = await pages().read(actor, 'stagea_child');
    await expect(publishing.publish(actor, offline.resourceKey, publication(offline), meta)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    const p = await pages().read(actor, 'stagea_parent');
    await expect(createWebsitePageDeletionService(client.database).remove(actor, p.key, { resourceId: p.resourceId, version: p.version, stateVersion: p.publication.stateVersion, publishedReleaseId: null, confirmation: p.key }, meta)).rejects.toMatchObject({ code: 'CONFLICT' });
    const currentParent = (await menus().list(actor)).find(row => row.id === parent.menu.id)!;
    await menus().update(actor, currentParent.id, menuUpdate(currentParent, { visible: true }), meta);
    const binding = createWebsitePageDeletionService(client.database);
    await binding.remove(actor, offline.key, { resourceId: offline.resourceId, version: offline.version, stateVersion: offline.publication.stateVersion, publishedReleaseId: null, confirmation: offline.key }, meta);
    expect(await menuRepository.byCode(client.database, offline.key)).toBeNull();
});
it('发布与隐藏并发只能提交一种状态', async () => {
    const { menu, page } = await makePage('stagea_race');
    const row = (await menus().list(actor)).find(r => r.id === menu.id)!;
    const result = await Promise.allSettled([
        createWebsitePublishingService(client.database).publish(actor, page.resourceKey, publication(page), meta),
        menus().update(actor, menu.id, menuUpdate(row, { visible: false }), meta),
    ]);
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const p = await pages().read(actor, page.key), m = (await menuRepository.byCode(client.database, page.key))!;
    expect(!p.publication.publishedReleaseId || m.visible).toBe(true);
});
it('仅授权子菜单不会获得父页面权限，授予父菜单也不包含子页面', async () => {
    const parent = await makePage('stagea_scope_parent'), child = await makePage('stagea_scope_child', parent.menu.id);
    const member = BigInt((await createAccountService(client.database, false).createOrdinary({ username: 'stagea_member', displayName: 'Scope', password: 'Scope Aurora 8462!' }, String(actor))).id);
    await client.database.update(adminUsers).set({ mustChangePassword: false });
    const role = await withEntityIds(client.database, 'admin_roles', { code: 'stagea_role', name: 'Scope' });
    await client.database.insert(adminRoles).values(role);
    await client.database.insert(adminUserRoles).values({ userId: member, roleId: role.id });
    await setRolePermissions(client.database, actor, String(role.id), { version: 1, permissions: ['content.pages.read', 'content.pages.update'] }, meta);
    await setRoleMenus(client.database, actor, String(role.id), { version: 2, menuIds: [child.menu.id] }, meta);
    const navigation = await menus().navigation(member);
    expect(navigation.items.find(row => row.id === parent.menu.id)?.path).toBeNull();
    expect(navigation.items.find(row => row.id === child.menu.id)?.path).toBeTruthy();
    await expect(pages().read(member, 'stagea_scope_parent')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(pages().read(member, 'stagea_scope_child')).resolves.toMatchObject({ key: 'stagea_scope_child' });
    await setRoleMenus(client.database, actor, String(role.id), { version: 3, menuIds: [parent.menu.id] }, meta);
    await expect(pages().read(member, 'stagea_scope_child')).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
