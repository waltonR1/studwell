vi.mock('../../server/repositories/site-languages',async()=>{const {defaultSiteLanguages}=await import('../../shared/config/site-languages');return {readLanguageConfig:async()=>({id:1,version:1,publishedReleaseId:null,languages:defaultSiteLanguages})}})
import imageRules from '../fixtures/reference/image-rules'
import {fixtureModulePolicy} from '../fixtures/website-module-policy'
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:fixtureModulePolicy})}))
import {fixtureRendererPaths} from '../fixtures/website-renderer-paths';
vi.mock('../../server/repositories/website-renderers', () => ({
    readWebsiteRenderers: async (_db: unknown, scope: 'public' | 'preview') =>
        Object.entries(fixtureRendererPaths(scope)).map(([key, path]) => ({key, path})),
}));

import {readSiteConfig} from '../../server/repositories/website-site-config';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import type { Database } from '../../server/db/transaction';
import { publicWebsitePage } from '../../server/services/public-website-page';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import type {SectionField} from '../../shared/types/website/section-template'
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import {readPublishedRoutes} from '../../server/repositories/website-route-tree';
import {templateDefinition} from '../fixtures/reference/template-catalog';
const mocks = vi.hoisted(() => ({ find: vi.fn(), all:vi.fn(), release: vi.fn(), media: vi.fn(), readSeo: vi.fn() }));
vi.mock('../../server/repositories/website-resources', () => ({ websiteResourceRepository: { find: mocks.find, all:mocks.all, release: mocks.release } }));
vi.mock('../../server/repositories/media', () => ({ mediaRepository: { find: mocks.media } }));
vi.mock('../../server/repositories/website-site-config', async (importOriginal) => ({ ...await importOriginal<typeof import('../../server/repositories/website-site-config')>(), readSeo: mocks.readSeo, readSiteConfig: vi.fn(async () => ({ id: 1, version: 1, publishedReleaseId: null })) }));
vi.mock('../../server/repositories/menus', () => ({ menuRepository: { all: vi.fn(async () => []) } }));
vi.mock('../../server/repositories/website-route-tree', () => ({ readPublishedRoutes: vi.fn(async () => [{ resourceId: 1n, path: '/home' }]) }));
const tx = {};
const database = { transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(tx)) } as unknown as Database;
const localized = (value: unknown) => Object.fromEntries(siteLocales.map(locale => [locale, structuredClone(value)]));
const fields: SectionField = { kind: 'group', label: 'Content', fields: {
        title: { kind: 'text', label: 'Title', required: true },
        image: { kind: 'media', label: 'Image', imagePreset:imageRules['photo'] }
    } };
function section(id: string, extra: Record<string, unknown> = {}) {
    return { id, templateKey: 'home.hero', anchorKey: `section-${id}`, sortOrder: Number(id), visible: true,
        renderer: String(extra.templateKey ?? 'home.hero'), videoPath: null, name: 'Fixture', allowedPages: 'all', definition: fields, mediaSlots: [], shared: { media: [] }, localized: localized({ title: 'Published', image: { mediaId: '9' } }), privateActor: 'SECRET', ...extra };
}
function snapshot(sections: unknown[]) {
    const settings = emptyPageSettings();
    settings.sceneEnabled = false;
    return { settings, sections };
}
beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSeo.mockResolvedValue([]);
    mocks.all.mockResolvedValue([]);
    vi.mocked(readPublishedRoutes).mockResolvedValue([{resourceId:1n,path:'/home'}] as Awaited<ReturnType<typeof readPublishedRoutes>>);
    mocks.find.mockResolvedValue({ type: 'page', id: 1n, publishedReleaseId: 2n });
    mocks.media.mockImplementation((_tx, id) => ({ id, storageKey: `uploads/asset-${id}.png`, kind: 'image', mime: 'image/png' }));
});
describe('公开页面正文', () => {
    it('缺少字段合同或媒体槽位的旧快照不能回退到当前模板', async () => {
        for (const missing of [{definition: undefined}, {definition: null}, {mediaSlots: undefined}]) {
            mocks.release.mockResolvedValue({id: 2n, content: snapshot([section('3', missing)])});
            await expect(publicWebsitePage(database, 'home', {})).rejects.toThrow();
        }
    });
    it('通用正文使用公开组件，后台专用预览路径不进入公开投影', async () => {
        const template=templateDefinition('content.text')!;
        const copy={title:'Services',body:'Published body'};
        mocks.release.mockResolvedValue({id:2n,content:snapshot([section('3',{templateKey:template.key,definition:template.fields,localized:localized({copy})})])});
        const page=await publicWebsitePage(database,'home',{});
        expect(page.sections[0]).toMatchObject({renderer:'app/components/public/sections/common/TextContent.vue',content:{copy}});
    });
    it('结构化页面 ID 跟随改名后的路由，自定义链接保持原地址',async()=>{
        mocks.all.mockResolvedValue([{id:1n,key:'page.home',type:'page',publishedReleaseId:2n},{id:123n,key:'page.about',type:'page',publishedReleaseId:10n}]);
        vi.mocked(readPublishedRoutes).mockResolvedValue([{resourceId:1n,path:'/home'},{resourceId:123n,path:'/new-company'}] as Awaited<ReturnType<typeof readPublishedRoutes>>);
        const definition:SectionField={kind:'group',label:'内容',fields:{data:{kind:'group',label:'跳转',fields:{targetResourceId:{kind:'link',label:'跳转目标',required:true}}}}};
        for(const [target,expected] of [
            [{type:'page',module:'about',resourceId:'123',value:''},'/new-company'],
            [{type:'custom',value:'/company'},'/company'],
        ] as const){
            mocks.release.mockResolvedValue({id:2n,content:snapshot([section('3',{templateKey:'content.page-entry',definition,localized:localized({data:{targetResourceId:target}})})])});
            const result=await publicWebsitePage(database,'home',{});
            expect(result.sections[0]!.content.data).toEqual({targetResourceId:expected});
        }
    });
    it('读取当前发布版本，默认英文，不返回页面结构、模板定义或管理字段', async () => {
        const value = section('3');
        value.localized = { ...localized({ title: 'Other', image: { mediaId: '9' } }), en: { title: 'English', image: { mediaId: '9' } }, zh: { title: '中文', image: { mediaId: '9' } } };
        mocks.release.mockResolvedValue({ id: 2n, content: snapshot([value]) });
        const result = await publicWebsitePage(database, 'home', {});
        expect(result).toMatchObject({ key: 'home', locale: 'en', releaseId: '2', sections: [{ id: '3', content: { title: 'English', image: { mediaId: '9', imagePreset:imageRules['photo'] } } }], media: { '9': { src: '/uploads/asset-9.png' } } });
        expect(Object.keys(result.sections[0]!)).toEqual(['id', 'renderer', 'shared', 'content']);
        expect(result.sections[0]!.renderer).toBe('app/components/public/sections/home/HeroSection.vue');
        expect(JSON.stringify(result)).not.toMatch(/SECRET|privateActor|definition|layoutOptions|createdBy/);
        expect(mocks.release).toHaveBeenCalledWith(tx, 2n, 1n);
        expect(readSiteConfig).toHaveBeenCalledTimes(1);
        expect((await publicWebsitePage(database, 'home', { locale: 'zh' })).sections[0]!.content.title).toBe('中文');
        expect(readSiteConfig).toHaveBeenCalledTimes(2);
    });

    it('同一资产引用去重，保留不同位置的取景；旧槽位合同不随新模板变化', async () => {
        const presentation = { desktop: { x: 20, y: 30, zoom: 1.5 } };
        const value = section('3', {
            templateKey: 'export.shippingSection',
            definition: { kind: 'group', label: 'Content', fields: { first: { kind: 'media', label: 'First', imagePreset:imageRules['photo'] }, image: { kind: 'media', label: 'Second', imagePreset:imageRules['photo'] } } },
            localized: localized({ first: { mediaId: '9' }, image: { mediaId: '9' } }),
            mediaSlots: [{ key: 'legacy-logo', name: 'Old logo', kind: 'image', imagePreset:imageRules['contain'] }],
            shared: { media: [{ key: 'legacy-logo', mediaId: '9', presentation }] }
        });
        mocks.release.mockResolvedValue({ id: 2n, content: snapshot([value]) });
        const result = await publicWebsitePage(database, 'export', {});
        expect(result.sections[0]!.shared.media[0]).toMatchObject({ key: 'legacy-logo', presentation, imagePreset:imageRules['contain'] });
        expect(result.sections[0]!.content.image).toEqual({ mediaId: '9', imagePreset:imageRules['photo'] });
        expect(result.media['9']).not.toHaveProperty('presentation');
        expect(mocks.media).toHaveBeenCalledTimes(1);
    });

    it('树、列表、视频与可选空图片按快照字段投影，不读取其他语言媒体', async () => {
        const definition: SectionField = { kind: 'group', label: 'Content', fields: {
                video: { kind: 'media', mediaKind: 'video', label: 'Video' },
                entries: { kind: 'list', label: 'Entries', item: { kind: 'media', label: 'Image', imagePreset:imageRules['photo'], optional: true } },
                tree: { kind: 'tree', label: 'Tree', fields: { name: { kind: 'text', label: 'Name' } } }
            } };
        const value = { video: { mediaId: '11' }, entries: [{ mediaId: null }], tree: { name: 'Root', children: [{ name: 'Child' }] } };
        mocks.release.mockResolvedValue({ id: 2n, content: snapshot([section('3', { definition, localized: { ...localized(value), zh: { ...value, video: { mediaId: '12' } } } })]) });
        mocks.media.mockResolvedValue({ id: 11n, kind: 'video', mime: 'video/mp4', storageKey: 'uploads/video.mp4' });
        const result = await publicWebsitePage(database, 'home', {});
        expect(result.sections[0]!.content).toEqual({ video: { mediaId: '11' }, entries: [{ mediaId: null, imagePreset:imageRules['photo'] }], tree: value.tree });
        expect(Object.keys(result.media)).toEqual(['11']);
        expect(mocks.media).toHaveBeenCalledTimes(1);
    });
    it.each([undefined, { type: 'page', id: 1n, publishedReleaseId: null }])('未发布或不存在时 404', async (resource) => {
        mocks.find.mockResolvedValue(resource);
        await expect(publicWebsitePage(database, 'home', {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
        expect(mocks.release).not.toHaveBeenCalled();
    });
    it('丢失快照、媒体记录或错误媒体类型均为内部错误，不假装空数据', async () => {
        mocks.release.mockResolvedValue(undefined);
        await expect(publicWebsitePage(database, 'home', {})).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        mocks.release.mockResolvedValue({ id: 2n, content: snapshot([section('3')]) });
        mocks.media.mockResolvedValue(undefined);
        await expect(publicWebsitePage(database, 'home', {})).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        mocks.media.mockResolvedValue({ id: 9n, kind: 'video', mime: 'video/mp4', storageKey: 'uploads/video.mp4' });
        await expect(publicWebsitePage(database, 'home', {})).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    });
    it.each([['../home', {}], ['home', { locale: 'bad' }], ['home', { draft: 'true' }], ['home', { locale: ['en', 'zh'] }]])('非法路径或查询先返回参数错误', async (key, query) => {
        await expect(publicWebsitePage(database, key, query)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(database.transaction).not.toHaveBeenCalled();
    });
});
