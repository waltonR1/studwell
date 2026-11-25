import {defaultSiteLanguages} from '../../shared/config/site-languages'
import { expect, it } from 'vitest';
import { createSearchDocuments, type SearchSnapshot } from '../../server/services/search-documents';
import type {SectionField} from '../../shared/types/website/section-template';
const field=(fields:Record<string,SectionField>):SectionField=>({kind:'group',label:'Group',fields});
const textField:SectionField={kind:'text',label:'Text'};
const searchFields={hero:field({copy:field({title:textField})}),body:field({copy:field({body:textField}),data:field({packaging:field({title:textField}),topics:{kind:'list',label:'Topics',item:field({title:textField})},image:{kind:'media',label:'Image'}})})};
import type { PublicSiteSettings } from '../../shared/types/public/website';
const fixture = () => ({ locale: 'en', settings: { pages: { about: { path: '/company',seo:{title:'Company',description:'Published company'}, renderer: 'about', releaseId: '1', sceneEnabled: false, sections: [{ id:'hero',capabilities:[] }, { id:'body',capabilities:[] }] } } } as unknown as PublicSiteSettings, pages: [{ key: 'about', locale: 'en', releaseId: '1', sections: [{ id: 'hero', content: { copy: { title: 'Public title' }, data: {} }, items: [] }, { id: 'body', content: { copy: { body: 'Public body' }, data: { image: { mediaId: 'private-id' }, src: '/private/source.jpg' } }, items: [] }], media: {}, searchFields:structuredClone(searchFields) } as unknown as SearchSnapshot['pages'][number]] });
it('静态搜索从已发布栏目正文生成，不收录媒体 ID 或私有文件地址', () => {
    const documents = createSearchDocuments(fixture());
    expect(documents).toEqual([expect.objectContaining({ path: '/company', title: 'Company', summary: 'Published company', body: 'Public title Public body', locale: 'en' })]);
});
it('配置正文不同版时拒绝生成混版索引', () => {
    const value = fixture();
    value.pages[0]!.releaseId = '2';
    expect(() => createSearchDocuments(value)).toThrow('Search snapshot is inconsistent');
});
it('缺少发布字段合同时拒绝生成，不回退到扫描任意正文',()=>{
    const value=fixture();
    delete (value.pages[0]!.searchFields as Record<string,SectionField>).hero;
    expect(()=>createSearchDocuments(value)).toThrow('Missing published search field definition');
});
it('产品和标识为 news 的普通页面均按已发布页面收录，正文不再跳过业务字段',()=>{
    const value=fixture();
    const structure=value.settings.pages.about!;
    value.settings.pages={news:{...structure,path:'/solutions/materials/cement/standards/europe/overview'}};
    value.pages[0]!.key='news';
    value.pages[0]!.sections[1]!.content.data={packaging:{title:'Bulk transport'},topics:[{title:'European standard'}],resourceId:'/private-target',image:{mediaId:'private-id',src:'/private/source.jpg'}};
    const [document]=createSearchDocuments(value);
    expect(document).toMatchObject({type:'pages',path:'/solutions/materials/cement/standards/europe/overview'});
    expect(document?.body).toContain('Bulk transport European standard');
    expect(document?.body).not.toMatch(/private-id|private-target|private\/source/);
});
it('新闻列表作为页面收录，动态详情占位路由及禁止索引页面不作为页面结果',()=>{
    const value=fixture();
    value.settings.pages.about!.sections=[{id:'list',templateKey:'custom.list',capabilities:['news.list'],sortOrder:0,anchorKey:'news'}];
    expect(createSearchDocuments(value)).toHaveLength(1);
    value.settings.pages.about!.path='/updates/:slug';
    expect(createSearchDocuments(value)).toEqual([]);
    value.settings.pages.about!.path='/updates';
    value.settings.pages.about!.seo.indexable=false;
    expect(createSearchDocuments(value)).toEqual([]);
});
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import { writeSearchIndexes } from '../../server/services/search-indexes';
import { validateIndex } from '../../app/utils/public/runtime/search/engine';
it('切换失败保留上一版，重试后清单和所有语言的索引一致', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'studwell-search-'));
    const snapshots = siteLocales.map(locale => {
        const snapshot = fixture();
        snapshot.settings.languages=structuredClone(defaultSiteLanguages);snapshot.settings.modules={news:true,careers:true};snapshot.settings.modulePolicyVersion=1;
        return { ...snapshot, locale, pages: snapshot.pages.map(page => ({ ...page, locale })) };
    });
    try {
        const read = async (file: string) => JSON.parse(await readFile(join(directory, file), 'utf8'));
        const previous = await writeSearchIndexes(directory, snapshots);
        const next = snapshots.map(snapshot => ({ ...snapshot, pages: [] }));
        await expect(writeSearchIndexes(directory, next, async () => { throw new Error('lease lost'); })).rejects.toThrow('lease lost');
        expect((await read('manifest.json')).versions).toEqual(previous);
        const active=await read('en.'+previous.en+'.json');
        expect(active.documents).toHaveLength(1);
        expect(validateIndex(active,'en')).toBe(true);
        expect(validateIndex({...active,schemaVersion:1},'en')).toBe(false);
        expect(validateIndex({...active,documents:active.documents.map((doc:object)=>({...doc,type:'products'}))},'en')).toBe(false);
        const versions = await writeSearchIndexes(directory, next);
        expect(versions).not.toEqual(previous);
        expect((await read('manifest.json')).versions).toEqual(versions);
        for (const locale of siteLocales) {
            const index = await read(locale + '.' + versions[locale] + '.json');
            expect(validateIndex(index, locale)).toBe(true);
            expect(index.documents).toEqual([]);
        }
    }
    finally {
        await rm(directory, { recursive: true, force: true });
    }
});
