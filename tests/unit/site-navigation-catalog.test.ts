import {fixtureModulePolicy} from '../fixtures/website-module-policy'
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:fixtureModulePolicy})}))
vi.mock('../../server/repositories/website-route-tree', () => ({ readPublishedRoutes: async () => [{ resourceId: 1n, path: '/company' }, { resourceId: 1n, path: '/company/published-slug' }, { resourceId: 2n, path: '/' }] }));
import { beforeEach, expect, it, vi } from 'vitest';
import type { DatabaseExecutor } from '../../server/db/transaction';
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import { siteLocales, siteLinkSchema, siteHeaderSchema } from '../../shared/schemas/admin/site-settings';
import { orderedSiteTargets } from '../../app/utils/admin/site-settings/targets';
import { publishedNavigationLinks } from '../../server/policies/website-navigation';
import { websiteNavigationTargets } from '../../server/services/website-navigation-targets';
const mocks = vi.hoisted(() => ({ menus: vi.fn(), all: vi.fn(), release: vi.fn() }));
vi.mock('../../server/repositories/menus', () => ({ menuRepository: { all: mocks.menus } }));
vi.mock('../../server/repositories/website-resources', () => ({ websiteResourceRepository: { all: mocks.all, release: mocks.release } }));
const db = {} as DatabaseExecutor;
const text = (value: string) => Object.fromEntries(siteLocales.map(locale => [locale, value]));
beforeEach(() => {
    vi.resetAllMocks();
    mocks.menus.mockResolvedValue([{ id: 1n, parentId: null, code: 'website_about', pageKey: 'website_page', name: '数据库名称', sortOrder: 2 }, { id: 2n, parentId: null, code: 'website_home', pageKey: 'website_page', name: '首页', sortOrder: 1 }]);
    mocks.all.mockResolvedValue([{ id: 1n, key: 'page.about', routePath: '/company', renderer: 'export', type: 'page', publishedReleaseId: 10n }, { id: 2n, key: 'page.home', routePath: '/', renderer: 'home', type: 'page', publishedReleaseId: 20n }, { id: 3n, key: 'page.draft', type: 'page', publishedReleaseId: null, stateVersion: 1 }, { id: 4n, key: 'page.offline', type: 'page', publishedReleaseId: null, stateVersion: 3 }]);
    mocks.release.mockImplementation(async (_db, id) => {
        const settings = emptyPageSettings();
        settings.displayName=text('数据库名称') as typeof settings.displayName
        return { content: { settings, sections: id === 10n ? [{ anchorKey: 'shown', name: '可见区块', visible: true }, { anchorKey: 'hidden-section', name: '隐藏区块', visible: false }] : [] } };
    });
});
it('只使用数据库发布快照，按页面菜单排序并排除未发布、撤回和隐藏目标', async () => {
    const targets = await websiteNavigationTargets(db);
    expect(targets.filter(item => item.target.type === 'page').map(item => item.target.module)).toEqual(['home', 'about']);
    expect(targets.find(item => item.key === 'page:about:')?.label.zh).toBe('数据库名称');
    expect(targets.filter(item => item.target.module === 'about').map(item => item.key)).toEqual(['page:about:', 'anchor:about:shown']);
    expect(orderedSiteTargets(targets).map(option => option.path)).toEqual(['/', '/company', '/company#shown']);
    expect(mocks.release).toHaveBeenCalledTimes(2);
    for (const target of targets)
        expect(siteLinkSchema.safeParse({ id: 'test', label: target.label, target: target.target, visible: true }).success).toBe(true);
    const about = targets.find(item => item.key === 'page:about:')!;
    expect(siteHeaderSchema.safeParse({ tagline: text(''), items: [{ id: 'test', label: text(''), target: about.target, visible: true, children: [] }] }).success).toBe(true);
});
it('按菜单树排列栏目，先父后子，同级按排序值及 ID 排列', async () => {
    mocks.menus.mockResolvedValue([
        {id: 10n, parentId: null, code: 'pages', pageKey: null, sortOrder: 5},
        {id: 1n, parentId: 10n, code: 'website_about', pageKey: 'website_page', sortOrder: 10},
        {id: 2n, parentId: 1n, code: 'website_home', pageKey: 'website_page', sortOrder: 0},
    ]);
    expect((await websiteNavigationTargets(db)).filter(item => item.target.type === 'page').map(item => item.target.module)).toEqual(['about', 'home']);
    mocks.menus.mockResolvedValue([
        {id: 2n, parentId: null, code: 'website_home', pageKey: 'website_page', sortOrder: 1},
        {id: 1n, parentId: null, code: 'website_about', pageKey: 'website_page', sortOrder: 1},
    ]);
    expect((await websiteNavigationTargets(db)).filter(item => item.target.type === 'page').map(item => item.target.module)).toEqual(['about', 'home']);
});
it('目录站内目标必须保存页面 ID',async()=>{for(const target of await websiteNavigationTargets(db))expect(target.target.resourceId).toBe(target.resourceId)});
it('允许自定义网址或站内路径，不把它们当作发布依赖', () => {
    const link = (value: string) => ({ id: 'test', label: text(''), target: { type: 'custom', value }, visible: true });
    for (const value of ['https://example.com/contact', '/products/cement?source=home#details']) {
        expect(siteLinkSchema.safeParse(link(value)).success).toBe(true);
        expect(publishedNavigationLinks({ items: [link(value)], contactTarget: link(value).target })).toEqual([]);
    }
    for (const value of ['', 'javascript:alert(1)', '//example.com', '/\\example.com']) {
        expect(siteLinkSchema.safeParse(link(value)).success).toBe(false);
    }
});
it('数据库为空时目录为空，不回退到静态官网数据', async () => {
    mocks.all.mockResolvedValue([]);
    expect(await websiteNavigationTargets(db)).toEqual([]);
    expect(mocks.release).not.toHaveBeenCalled();
});
it('发布记录缺失时不产生幽灵目标', async () => {
    mocks.release.mockResolvedValue(undefined);
    expect(await websiteNavigationTargets(db)).toEqual([]);
});
