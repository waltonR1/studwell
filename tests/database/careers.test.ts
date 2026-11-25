import { afterAll, beforeAll, expect, it } from 'vitest';
import { setupTestDatabase, cleanTestDatabase } from './support';
import { seedRoot } from '../../scripts/database/seed/system';
import { createRbacService } from '../../server/services/rbac';
import { createMenuService } from '../../server/services/menus';
import { createCareerService } from '../../server/services/careers';
import { createPublicCareerService } from '../../server/services/public-careers';
import { websiteResourceRepository as pages } from '../../server/repositories/website-resources';
import { withEntityIds } from '../../server/db/allocate-entity-id';
import { adminUsers, websiteResources } from '../../server/db/schema';
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import { careerContentSchema, careerLocales } from '../../shared/schemas/admin/careers';
let client: Awaited<ReturnType<typeof setupTestDatabase>>, actor: bigint;
const meta = { ip: 'local', userAgent: 'careers-test', requestId: '00000000-0000-4000-8000-000000000001' };
const state = (p: {
    version: number;
    publishedReleaseId: string | null;
}) => ({ version: p.version, publishedReleaseId: p.publishedReleaseId });
beforeAll(async () => {
    client = await setupTestDatabase();
    actor = BigInt((await seedRoot(client.database, 'Careers fixture Aurora mist 8462!')).id);
    await client.database.update(adminUsers).set({ mustChangePassword: false });
});
afterAll(async () => { if (client)
    await cleanTestDatabase(client); });
it('Root 导航显示招聘中心及岗位管理入口', async () => {
    const db = client.database;
    await createRbacService(db).sync();
    const { items } = await createMenuService(db).navigation(actor);
    const group = items.find(item => item.code === 'careers_center');
    const position = items.find(item => item.code === 'career_positions');
    expect(group).toMatchObject({ name: '招聘中心', parentId: null });
    expect(position).toMatchObject({ name: '岗位管理', parentId: group?.id, path: '/admin/careers/positions' });
});
it('岗位草稿、发布、修改和下线遵循独立发布版本', async () => {
    const db = client.database, service = createCareerService(db);
    const page = await withEntityIds(db, 'website_resources', { key: 'page.jobs', type: 'page', createdBy: actor, updatedBy: actor });
    await db.insert(websiteResources).values(page);
    const release = await pages.append(db, { resourceId: page.id, content: { settings: emptyPageSettings(), sections: [{ templateKey: 'careers.positionsSection', visible: true }] }, draftVersion: 1, createdBy: actor });
    await pages.activate(db, page.id, release.id);
    const publicCareers = createPublicCareerService(db);
    expect(await publicCareers.list({ locale: 'zh' })).toEqual([]);
    const content = careerContentSchema.parse({
        sortOrder: 10,
        localized: Object.fromEntries(careerLocales.map(locale => [locale, { title: '海外市场专员', department: '海外事业部', location: '杭州', responsibilities: ['职责'], requirements: ['要求'] }]))
    });
    const created = await service.mutate(actor, meta, 'create', null, { content });
    expect(await publicCareers.list({ locale: 'zh' })).toEqual([]);
    const published = await service.mutate(actor, meta, 'publish', created.id, state(created));
    const zh = (await publicCareers.list({ locale: 'zh' }));
    const fr = (await publicCareers.list({ locale: 'fr' }));
    expect(zh).toEqual(fr);
    expect(zh[0]).toMatchObject({ id: created.id, title: '海外市场专员' });
    const listing = await service.list(actor, { page: 1, pageSize: 1, search: '海外', status: 'published' });
    expect(listing).toMatchObject({ total: 1, page: 1, pageSize: 1 });
    expect(listing.items[0]).toMatchObject({ id: created.id, content: { localized: { zh: { title: '海外市场专员' } } } });
    const draft = structuredClone(published.content);
    draft.localized.zh.title = '草稿岗位名称';
    const edited = await service.mutate(actor, meta, 'update', published.id, { content: draft, version: published.version });
    expect((await publicCareers.list({ locale: 'zh' }))[0]?.title).toBe('海外市场专员');
    await expect(service.mutate(actor, meta, 'publish', published.id, state(published))).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
    const republished = await service.mutate(actor, meta, 'publish', edited.id, state(edited));
    expect((await publicCareers.list({ locale: 'zh' }))[0]?.title).toBe('草稿岗位名称');
    await service.mutate(actor, meta, 'withdraw', republished.id, state(republished));
    expect(await publicCareers.list({ locale: 'zh' })).toEqual([]);
    expect(await service.list(actor, { page: 1, pageSize: 10, search: '', status: 'published' })).toMatchObject({ items: [], total: 0 });
    const secondContent = careerContentSchema.parse({
        sortOrder: 0,
        localized: Object.fromEntries(careerLocales.map(locale => [locale, { title: '国际物流专员', department: '物流部', location: '杭州', responsibilities: ['协调物流'], requirements: ['物流经验'] }]))
    });
    const second = await service.mutate(actor, meta, 'create', null, { content: secondContent });
    const beforeMove = await service.list(actor, { page: 1, pageSize: 10, search: '', status: 'all' });
    expect(beforeMove.items.map(item => item.content.localized.zh.title)).toEqual(['草稿岗位名称', '国际物流专员']);
    const neighbor = beforeMove.items[0]!;
    await expect(service.move(actor, meta, second.id, { version: second.version, neighborId: neighbor.id, neighborVersion: neighbor.version + 1, direction: 'up' })).rejects.toMatchObject({ code: 'CONFLICT', reason: 'STALE' });
    expect((await service.list(actor, { page: 1, pageSize: 10, search: '', status: 'all' })).items.map(item => item.content.localized.zh.title)).toEqual(['草稿岗位名称', '国际物流专员']);
    await service.move(actor, meta, second.id, { version: second.version, neighborId: neighbor.id, neighborVersion: neighbor.version, direction: 'up' });
    const afterMove = await service.list(actor, { page: 1, pageSize: 10, search: '', status: 'all' });
    expect(afterMove.items.map(item => item.content.localized.zh.title)).toEqual(['国际物流专员', '草稿岗位名称']);
});
