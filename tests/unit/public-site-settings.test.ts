vi.mock('../../server/repositories/site-languages',async()=>{const {defaultSiteLanguages}=await import('../../shared/config/site-languages');return {readLanguageConfig:async()=>({id:1,version:1,publishedReleaseId:null,languages:defaultSiteLanguages})}})
import imageRules from '../fixtures/media/image-rules'
vi.mock('../../server/repositories/website-image-rules',async()=>{const {default:rules}=await import('../fixtures/media/image-rules');return {readModuleImageRules:async()=>({logo:rules.contain,favicon:rules.icon,newsCover:rules.photo,newsBody:rules.contain})}})
import {emptySiteText} from '../../shared/utils/admin/site-settings'
import {fixtureModulePolicy} from '../fixtures/website-module-policy'
vi.mock('../../server/repositories/website-module-policy',()=>({readWebsiteModulePolicy:async()=>({version:1,policy:fixtureModulePolicy})}))
import {readSiteConfig} from '../../server/repositories/website-site-config';
import {defaultSiteLanguages} from '../../shared/config/site-languages'
import { seoEntries } from '../fixtures/website-seo';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectPublicSiteSettings, publicSiteSettings } from '../../server/services/public-site-settings';
import { emptyPageSettings } from '../../shared/utils/website/page-layouts';
import {createSiteSettings,createSiteLink} from '../../shared/utils/admin/site-settings'
import type { Database } from '../../server/db/transaction';
const mocks = vi.hoisted(() => ({ all: vi.fn(), release: vi.fn(), media: vi.fn(), readSeo: vi.fn() }));
vi.mock('../../server/repositories/website-resources', () => ({ websiteResourceRepository: { all: mocks.all, release: mocks.release } }));
vi.mock('../../server/repositories/media', () => ({ mediaRepository: { find: mocks.media } }));
vi.mock('../../server/repositories/website-site-config', async (importOriginal) => ({ ...await importOriginal<typeof import('../../server/repositories/website-site-config')>(), readSeo: mocks.readSeo, readSiteConfig: vi.fn(async () => ({ id: 1, version: 1, publishedReleaseId: null })) }));
vi.mock('../../server/repositories/menus', () => ({ menuRepository: { all: vi.fn(async () => []) } }));
const tx = { select: () => ({ from: async () => [{ resourceId: 1n, path: '/company' }] }) };
const database = { transaction: vi.fn(async (work: (value: unknown) => unknown) => work(tx)) } as unknown as Database;
const section = (id: string, visible = true) => ({ id, visible, templateKey: 'home.hero', sortOrder: 0, anchorKey: 'hero', localized: { secret: 'private body' }, createdBy: 'private actor' });
beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSeo.mockResolvedValue([]);
    mocks.all.mockResolvedValue([]);
});
describe('公开公共配置发布投影', () => {
    it('预览可投影未发布的页头草稿，公开配置仍不读取草稿', async () => {
        const content=createSiteSettings()
        content.header.tagline.en='Saved draft'
        mocks.all.mockResolvedValue([{type:'header',key:'site.header',id:1n,publishedReleaseId:null}])
        const draft=await database.transaction(executor=>projectPublicSiteSettings(executor,'en',true,undefined,{section:'header',content:content.header}))
        expect(draft.header?.tagline).toBe('Saved draft')
        expect((await publicSiteSettings(database,{locale:'en'})).header).toBeNull()
        expect(mocks.release).not.toHaveBeenCalled()
    })
    it('默认英文，未发布资源不读取草稿或版本，公共部分为 null', async () => {
        mocks.all.mockResolvedValue([{ type: 'page', key: 'page.home', id: 1n, publishedReleaseId: null }]);
        expect(await publicSiteSettings(database, {})).toEqual({ modulePolicyVersion:1,modules:{news:true,careers:true,inquiries:true},languages:defaultSiteLanguages,languageReleaseId:null,configReleaseId: null, locale: 'en', basic: null, header: null, footer: null, pages: {} });
        expect(mocks.release).not.toHaveBeenCalled();
        expect(readSiteConfig).toHaveBeenCalledTimes(1);
        expect(database.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'repeatable read' });
    });
    it('页面结构只含顺序区块与独立 SEO',async()=>{
     const settings=emptyPageSettings();settings.displayName={zh:'中文页面',en:'Published English page',fr:'Page française',es:'Página',pt:'Página'}
     mocks.all.mockResolvedValue([{type:'page',key:'page.about',id:1n,publishedReleaseId:2n}])
     mocks.release.mockResolvedValue({id:2n,content:{settings,sections:[section('3'),section('4',false)]}})
     mocks.readSeo.mockResolvedValue(seoEntries('1',{title:'Independent published SEO'}))
     const result=await publicSiteSettings(database,{})
     expect(result.pages.about).toMatchObject({displayName:'Published English page',sceneEnabled:false,seo:{title:'Independent published SEO'},sections:[{id:'3'}]})
     expect(result.pages.about?.sections).toHaveLength(1)
     expect(JSON.stringify(result)).not.toMatch(/private|layoutOptions|columnKey/)
    })
    it('独立投影标识、导航和页脚，图片直接访问，隐藏父项连同子项过滤', async () => {
        const content = createSiteSettings();
        content.basic.logoId = '9';
        content.header.tagline.en = 'Published tagline';
        content.header.items = [{ ...createSiteLink('hidden',{module:'home',resourceId:'1'}), visible: false, children: [createSiteLink('child',{module:'home',resourceId:'1'})] }, { ...createSiteLink('shown',{module:'home',resourceId:'1'}), children: [] }];
        const byType = { basic: content.basic, header: content.header, footer: content.footer };
        mocks.all.mockResolvedValue(['basic', 'header', 'footer'].map((type, index) => ({ type, id: BigInt(index + 1), publishedReleaseId: BigInt(index + 11) })));
        mocks.release.mockImplementation((_tx, id: bigint) => ({ id, content: byType[['basic', 'header', 'footer'][Number(id) - 11] as keyof typeof byType] }));
        mocks.media.mockResolvedValue({ id: 9n, kind: 'image', mime: 'image/png', storageKey: 'uploads/logo.png', secret: 'hidden' });
        const result = await publicSiteSettings(database, {});
        expect(result.basic?.logo).toEqual({ id: '9', src: '/uploads/logo.png', kind: 'image', mime: 'image/png',presentation:undefined,imagePreset:imageRules.contain });
        expect(result.header?.tagline).toBe('Published tagline');
        expect(result.header?.items.some(item => item.id === content.header.items[0]!.id)).toBe(false);
        expect(result.footer?.description).toBe(content.footer.description.en);
    });
    it('显式语言不回退，缺失已发布快照或损坏媒体返回内部错误', async () => {
        const value = createSiteSettings().header;
        value.tagline.en = 'English';
        value.tagline.fr = '';
        mocks.all.mockResolvedValue([{ type: 'header', id: 1n, publishedReleaseId: 2n }]);
        mocks.release.mockResolvedValue({ id: 2n, content: value });
        expect((await publicSiteSettings(database, { locale: 'fr' })).header?.tagline).toBe('');
        mocks.release.mockResolvedValue(undefined);
        await expect(publicSiteSettings(database, {})).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        mocks.all.mockResolvedValue([{ type: 'basic', id: 1n, publishedReleaseId: 2n }]);
        mocks.release.mockResolvedValue({ content: { logoId: '9', faviconId: null } });
        mocks.media.mockResolvedValue(undefined);
        await expect(publicSiteSettings(database, {})).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
    });
    it.each([{ locale: 'zh-CN' }, { locale: ['en', 'zh'] }, { draft: 'true' }])('先拒绝非法查询 %j', async (query) => {
        await expect(publicSiteSettings(database, query)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
        expect(database.transaction).not.toHaveBeenCalled();
    });
});

it('页脚联系条目按数据库顺序和当前语言投影，隐藏及空内容不公开',async()=>{
 const footer=createSiteSettings().footer
 footer.contacts=[{id:'sales',kind:'email',label:{...emptySiteText(),en:'Customer service',fr:'Service client'},value:{...emptySiteText(),en:'hello@example.com'},visible:true},{id:'hidden',kind:'text',label:emptySiteText(),value:{...emptySiteText(),en:'Private'},visible:false}]
 mocks.all.mockResolvedValue([{type:'footer',key:'site.footer',id:1n,publishedReleaseId:2n}])
 mocks.release.mockResolvedValue({id:2n,content:footer})
 expect((await publicSiteSettings(database,{locale:'en'})).footer?.contacts).toEqual([{id:'sales',kind:'email',label:'Customer service',value:'hello@example.com'}])
 expect((await publicSiteSettings(database,{locale:'fr'})).footer?.contacts).toEqual([])
})
