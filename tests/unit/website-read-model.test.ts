import {templateDefinition} from '../fixtures/reference/template-catalog';
import { expect, it, vi } from 'vitest';
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import { resourcePublication, resourceSnapshot, type WebsiteResource } from '../../server/services/website-read-model';
import type { DatabaseExecutor } from '../../server/db/transaction';
const state = vi.hoisted(() => ({ releases: vi.fn(), draft: vi.fn(), sections: vi.fn() }));
vi.mock('../../server/repositories/accounts',()=>({accountRepository:{identities:vi.fn(async()=>[{id:1n,username:'publisher',enabled:true,deletedAt:null}])}}));
vi.mock('../../server/repositories/website-resources', () => ({ websiteResourceRepository: { listReleases: state.releases, draft: state.draft, sections: state.sections } }));
it('历史快照缺少媒体显示元数据不会误报草稿变化，正文变化仍标记待发布', async () => {
    const db = {} as DatabaseExecutor, resource = { id: 1n, key: 'page.export', type: 'page', stateVersion: 2, draftVersion: 3, publishedReleaseId: 2n } as WebsiteResource;
    const settings = emptyPageSettings();
    state.draft.mockResolvedValue({ content: settings });
    state.sections.mockResolvedValue([{ section: { id: 3n, sortOrder: 0, visible: true, anchorKey: 'hero', sharedContent: { media: [] }, localizedContent: { zh: { title: '原内容' } } }, template: { key: 'hero.export' }, revision: {definition:templateDefinition('hero.export')!} }]);
    const snapshot = await resourceSnapshot(db, resource) as {
        sections: Array<Record<string, unknown>>;
    };
    expect(snapshot.sections[0]!.mediaSlots).toBeDefined();
    const historical = { ...snapshot, sections: snapshot.sections.map(({ mediaSlots, ...section }) => section) };
    state.releases.mockResolvedValue([{ id: 2n, draftVersion: 3, createdAt: new Date(), createdBy: 1n, restoredFrom: null, content: historical }]);
    expect((await resourcePublication(db, resource)).changed).toBe(false);
    historical.sections[0]!.localized = { zh: { title: '另一版本' } };
    expect((await resourcePublication(db, resource)).changed).toBe(true);
});
it('栏目图片取景完整进入发布快照，取景变化标记待发布', async () => {
    const db = {} as DatabaseExecutor, resource = { id: 1n, key: 'page.sustainability', type: 'page', stateVersion: 2, draftVersion: 3, publishedReleaseId: 2n } as WebsiteResource;
    const localized = { zh: { data: { topics: [{ slug: 'transfer', image: { mediaId: '2026110214000000001', presentation: { desktop: { x: 50, y: 35, zoom: 1 } } } }] } } };
    state.draft.mockResolvedValue({ content: emptyPageSettings() });
    state.sections.mockResolvedValue([{ section: { id: 3n, sortOrder: 0, visible: true, anchorKey: 'hero', sharedContent: { media: [] }, localizedContent: localized }, template: { key: 'hero.column' }, revision: {definition:templateDefinition('hero.column')!} }]);
    const snapshot = await resourceSnapshot(db, resource) as {
        sections: Array<{
            localized: typeof localized;
        }>;
    };
    expect(snapshot.sections[0]!.localized).toEqual(localized);
    state.releases.mockResolvedValue([{ id: 2n, draftVersion: 3, createdAt: new Date(), createdBy: 1n, restoredFrom: null, content: structuredClone(snapshot) }]);
    expect((await resourcePublication(db, resource)).changed).toBe(false);
    localized.zh.data.topics[0]!.image.presentation.desktop.y = 25;
    expect((await resourcePublication(db, resource)).changed).toBe(true);
});
