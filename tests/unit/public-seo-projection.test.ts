vi.mock('../../server/repositories/site-languages',async()=>{const {defaultSiteLanguages}=await import('../../shared/config/site-languages');return {readLanguageConfig:async()=>({id:1,version:1,publishedReleaseId:null,languages:defaultSiteLanguages})}})
import {fixtureModulePolicy} from '../fixtures/website-module-policy'
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:fixtureModulePolicy})}))
import { expect,it,vi } from 'vitest';
import type { DatabaseExecutor } from '../../server/db/transaction';
import { readPublishedRoutes } from '../../server/repositories/website-route-tree';
import { readSeo } from '../../server/repositories/website-site-config';
import { projectPublicWebsitePage,projectWebsiteSnapshot } from '../../server/services/public-website-page';
import { resolveSeo } from '../../server/services/public-website-seo';
import { seoFor } from '../../server/policies/website-seo';
import { createSearchDocuments } from '../../server/services/search-documents';
import type { PublicSiteSettings } from '../../shared/types/public/website';
import type { WebsiteSeoEntry } from '../../shared/types/website/site-config';
import { fixturePageSettings } from '../fixtures/website-page-settings';
vi.mock('../../server/repositories/website-site-config', async (importOriginal) => ({ ...await importOriginal<object>(), readSeo: vi.fn(async () => []), readSiteConfig: vi.fn(async () => ({ publishedReleaseId: null })) }));
vi.mock('../../server/repositories/website-route-tree', () => ({ readPublishedRoutes: vi.fn(async () => []) }));
vi.mock('../../server/repositories/website-resources', () => ({ websiteResourceRepository: { find: vi.fn(async () => ({ id: 123n, type: 'page', publishedReleaseId: 456n })), release: vi.fn() } }));
vi.mock('../../server/services/public-media', () => ({ createPublicMediaResolver: () => async (id: string) => ({ id, src: '/uploads/og.png', kind: 'image', mime: 'image/png' }) }));
const entry = (fields: Partial<WebsiteSeoEntry> = {}): WebsiteSeoEntry => ({ resourceId: '9007199254740993123', locale: 'en', title: 'Published title', description: 'Published description', indexable: true, ogTitle: 'Social title', ogDescription: 'Social description', ogMediaId: null, ...fields });
it('matches exact string resource, target and locale identities without fallback', () => {
    const row=entry();expect(seoFor([row],row.resourceId,'en').title).toBe('Published title')
    expect(seoFor([row],row.resourceId,'fr')).toEqual({title:'',description:'',indexable:false})
    expect(seoFor([row],'other','en').indexable).toBe(false)
});
it('resolves independent OG media and preserves explicit noindex', async () => {
    const row = entry({ ogMediaId: '123', indexable: false });
    const seo = await resolveSeo({} as DatabaseExecutor, [row], row.resourceId, 'en');
    expect(seo).toMatchObject({ indexable: false, ogTitle: 'Social title', ogDescription: 'Social description', ogImage: { src: '/uploads/og.png' } });
});

it('rejects published content without any published route before reading its body', async () => {
    await expect(projectPublicWebsitePage({} as DatabaseExecutor, 'unrouted', 'en')).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
it('preview projects unrouted draft content using draft SEO rows', async () => {
    vi.mocked(readSeo).mockClear();
    vi.mocked(readPublishedRoutes).mockClear();
    const raw = { settings: { ...fixturePageSettings(), sceneEnabled: false }, sections: [] };
    const page = await projectWebsiteSnapshot({} as DatabaseExecutor, 'unrouted', 'en', 'preview', raw, true);
    expect(page.releaseId).toBe('preview');
    expect(readSeo).not.toHaveBeenCalled();
    expect(readPublishedRoutes).not.toHaveBeenCalled();
});

it('suppresses article search under a noindex news parent', () => {
    const settings = { pages: { updates: { path: '/updates', sceneEnabled: false, seo: { indexable: false }, sections: [{ templateKey:'custom.list',capabilities:['news.list'] }] } } } as unknown as PublicSiteSettings;
    const news = [{ id: '1', slug: 'article', content: { localized: { en: { title: 'Article', summary: 'Summary', body: [] } }, displayDate: '2026-11-13' }, categoryName: { en: 'News' } }] as unknown as NonNullable<Parameters<typeof createSearchDocuments>[0]['news']>;
    expect(createSearchDocuments({ locale: 'en', settings, pages: [], news })).toEqual([]);
    settings.pages.updates!.seo.indexable = true;
    expect(createSearchDocuments({ locale: 'en', settings, pages: [], news })).toEqual([]);
    settings.pages.detail = {...settings.pages.updates!,path:'/updates/:slug',sections:[{id:'1',templateKey:'custom.article',capabilities:['news.article'],sortOrder:0,anchorKey:'article'}]};
    expect(createSearchDocuments({ locale: 'en', settings, pages: [], news })).toEqual([expect.objectContaining({ path: '/updates/article' })]);
    settings.pages.detail!.seo={...settings.pages.detail!.seo,indexable:false};
    expect(createSearchDocuments({ locale: 'en', settings, pages: [], news })).toEqual([]);
    settings.pages.detail!.seo={...settings.pages.detail!.seo,indexable:true};
    settings.pages.fixed = {...settings.pages.updates!,path:'/updates/article',sections:[]};
    expect(createSearchDocuments({ locale: 'en', settings, pages: [], news })).toEqual([]);
});
