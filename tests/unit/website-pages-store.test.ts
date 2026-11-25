import { createPinia,setActivePinia } from 'pinia';
import { beforeEach,expect,it,vi } from 'vitest';
import { nextTick,reactive } from 'vue';
import { useAdminWebsitePagesStore } from '../../app/stores/admin/website-pages';
import { useAdminNavigationTargetsStore } from '../../app/stores/admin/navigation-targets';
import { valueAt } from '../../app/utils/admin/website/section-forms';
import { siteLocales } from '../../shared/schemas/admin/site-settings';
import type { WebsitePageRecord } from '../../shared/types/admin/website';
import { emptySectionContent } from '../../shared/utils/website/page-layouts';
import { templateDefinition as currentTemplate } from '../fixtures/reference/template-catalog';
import { fixturePageSettings } from '../fixtures/website-page-settings';
const state = vi.hoisted(() => ({ read: vi.fn(), mutate: vi.fn(), session: { generation: 0, can: () => true, transition: 'reset', currentUser: null as {
            id: string;
        } | null } }));
vi.mock('~/stores/admin/request', () => ({ useAdminRequestStore: () => ({ read: state.read, mutate: state.mutate, message: () => '加载失败', operationMessage: () => '操作失败' }) }));
vi.mock('~/stores/admin/session', () => ({ useAdminSessionStore: () => state.session }));
vi.mock('~/stores/admin/navigation', () => ({ useAdminNavigationStore: () => ({ invalidate: vi.fn() }) }));
const fixture = (): WebsitePageRecord => ({ resourceId: '2026103118000000001', persisted: true, scopeGranted: true, key: 'export', name: '出口业务', resourceKey: 'page.export', routePath: '/export', version: 1, settingsVersion: 1, settings: { ...fixturePageSettings(), sceneEnabled: false }, sections: [], templates: [], publication: { stateVersion: 1, status: 'unpublished', changed: true, draftVersion: 1, publishedReleaseId: null, publishedDraftVersion: null, releases: [] }, updatedAt: '2026-10-31T00:00:00Z', updatedBy: '2026103101000000001' });
beforeEach(() => { setActivePinia(createPinia()); state.session = reactive({ generation: 0, can: () => true, transition: 'reset', currentUser: null as {
        id: string;
    } | null }); state.read.mockReset(); state.mutate.mockReset(); });
it('历史清理只刷新发布元数据，保留页面设置中未保存的输入',async()=>{
 const page=fixture();state.read.mockResolvedValue(page)
 const store=useAdminWebsitePagesStore();await store.enter('export','settings')
 store.draft!.settings.displayName.zh='未保存的页面名称'
 const publication={...page.publication,stateVersion:2}
 state.mutate.mockResolvedValue({deleted:true});state.read.mockResolvedValue(publication)
 await store.cleanupRelease('2026110523000000002')
 expect(store.dirty).toBe(true);expect(store.draft!.settings.displayName.zh).toBe('未保存的页面名称')
 expect(store.record!.publication.stateVersion).toBe(2);expect(store.draft!.publication.stateVersion).toBe(2)
 expect(state.mutate).toHaveBeenCalledWith('publication-history/cleanup','POST',expect.objectContaining({kind:'website',key:'page.export',version:1,stateVersion:1}))
})
it('内容初始化进入实际草稿，保存固定行且不改已保存基线，刷新后不再产生修改', async () => {
    const page = fixture(), definition = currentTemplate('home.statistics')!, id = '2026103120000000999';
    page.sections = [{ id, templateId: '2026103119000000999', templateKey: definition.key, name: definition.name, sortOrder: 0, visible: true, anchorKey: 'statistics', contentVersion: 3, structureVersion: 2, shared: { media: [] }, localized: Object.fromEntries(siteLocales.map(locale => [locale, emptySectionContent(definition.fields)])) as WebsitePageRecord['sections'][number]['localized'], definition }];
    const original = structuredClone(page);
    state.read.mockResolvedValue(page);
    const store = useAdminWebsitePagesStore();
    await store.enter('export');
    expect(store.dirty).toBe(false);
    await store.enter('export', id);
    expect(store.record).toEqual(original);
    expect(page).toEqual(original);
    expect(store.dirty).toBe(true);
    for (const locale of siteLocales)
        expect(valueAt(store.section!.localized[locale], 'data.statistics.statistics')).toHaveLength(5);
    const saved = JSON.parse(JSON.stringify(store.draft!)) as WebsitePageRecord;
    state.mutate.mockResolvedValueOnce(saved);
    await store.save();
    expect(state.mutate).toHaveBeenLastCalledWith(`pages/export/sections/${id}`, 'PUT', expect.objectContaining({ localized: saved.sections[0]!.localized, contentVersion: 3, structureVersion: 2 }));
    expect(store.dirty).toBe(false);
    state.read.mockResolvedValueOnce(saved);
    await store.load();
    expect(store.dirty).toBe(false);
    state.session.can = () => false;
    state.read.mockResolvedValueOnce(original);
    await store.enter('export', id);
    expect(store.draft).toEqual(original);
    expect(store.dirty).toBe(false);
});
it('切换页面及会话失效丢弃旧请求响应', async () => {
    let finish!: (v: unknown) => void;
    state.read.mockReturnValueOnce(new Promise(r => { finish = r; })).mockResolvedValueOnce({ ...fixture(), key: 'about' });
    const store = useAdminWebsitePagesStore(), old = store.enter('export');
    await store.enter('about');
    finish(fixture());
    await old;
    expect(store.record!.key).toBe('about');
    state.session.generation++;
    await nextTick();
    expect(store.record).toBeNull();
});


it('旧编辑器卸载不能清空新 Section 的加载状态', async () => {
    state.read.mockResolvedValue(fixture());
    const store = useAdminWebsitePagesStore();
    await store.enter('export', 'settings');
    await store.enter('export', '2026103120000000001');
    store.leave('export', 'settings');
    expect(store.record?.key).toBe('export');
    expect(store.active).toBe('2026103120000000001');
    store.leave('export', '2026103120000000001');
    expect(store.record).toBeNull();
});


it.each(['logout', 'switch'])('%s 后不可恢复原账户草稿', async (reason) => {
    state.session.currentUser = { id: 'owner' };
    state.read.mockResolvedValue(fixture());
    const store = useAdminWebsitePagesStore();
    await store.enter('export');
    store.draft!.settings.sceneEnabled = true;
    state.session.transition = 'expired';
    state.session.generation++;
    state.session.transition = reason;
    state.session.generation++;
    state.session.currentUser = { id: reason === 'switch' ? 'another' : 'owner' };
    await store.enter('export');
    expect(store.draft!.settings.sceneEnabled).toBe(false);
});








it('区块弹窗确认前不改草稿，取消丢弃输入，确认后才写入配置', async () => {
    const page = fixture(), definition = currentTemplate('home.about')!;
    page.templates = [{ id: 'template', key: definition.key, name: '公司介绍', description: '', coverMediaId: null, enabledForNew: true, metadataVersion: 1, definition }];
    state.read.mockResolvedValue(page);
    const store = useAdminWebsitePagesStore();
    await store.enter('export');
    store.editAssembly();
    store.assemblyEditor!.templateId = 'template';
    expect(store.assemblyEditorDirty).toBe(true);
    expect(store.dirty).toBe(false);
    expect(await store.publish()).toBeNull();
    expect(state.mutate).not.toHaveBeenCalled();
    store.closeAssemblyEditor();
    expect(store.draft!.sections).toHaveLength(0);
    store.editAssembly();
    store.assemblyEditor!.templateId = 'template';
    expect(store.confirmAssembly()).toBe(true);
    expect(store.assemblyEditor).toBeNull();
    expect(store.draft!.sections).toHaveLength(1);
    expect(store.dirty).toBe(true);
});
it('无效模板和区域不产生区块，刷新与离开清理弹窗', async () => {
    state.read.mockResolvedValue(fixture());
    const store = useAdminWebsitePagesStore();
    await store.enter('export');
    store.editAssembly();
    store.assemblyEditor!.templateId = 'missing';
    expect(store.confirmAssembly()).toBe(false);
    expect(store.assemblyEditorError).toBeTruthy();
    expect(store.draft!.sections).toHaveLength(0);
    await store.load();
    expect(store.assemblyEditor).toBeNull();
    store.editAssembly();
    store.leave();
    expect(store.assemblyEditor).toBeNull();
});




it('顺序装配可添加页面级 Hero，不要求栏目归属', async () => {
    const page = fixture(), definition = currentTemplate('hero.news')!;
    page.key = 'news';
    page.templates = [{ id: '2026103119000000999', key: definition.key, name: definition.name, description: '', coverMediaId: null, enabledForNew: true, metadataVersion: 1, definition }];
    state.read.mockResolvedValue(page);
    const store = useAdminWebsitePagesStore();
    await store.enter('news');
    store.add('2026103119000000999');
    expect(store.draft!.sections).toHaveLength(1);
    expect(store.draft!.sections[0]).toMatchObject({ templateKey: 'hero.news' });
    expect(store.placementIssues).toEqual([]);
});




it('跳转目标独立于页面草稿按需加载，失败保留错误并可重试', async () => {
    const store = useAdminNavigationTargetsStore();
    state.read.mockRejectedValueOnce(new Error('targets'));
    await store.loadNavigationTargets();
    expect(store.navigationTargetsError).toBe('加载失败');
    expect(store.navigationTargetsLoaded).toBe(false);
    expect(store.navigationTargets).toEqual([]);
    const target = { key: 'page:home:', resourceId:'1', path: '/', label: Object.fromEntries(siteLocales.map(locale => [locale, '首页'])), target: { module: 'home', resourceId:'1', type: 'page', value: '' } } as const;
    state.read.mockResolvedValueOnce([target]);
    await store.loadNavigationTargets(true);
    expect(store.navigationTargetsError).toBe('');
    expect(store.navigationTargetsLoaded).toBe(true);
    expect(store.navigationTargets).toEqual([target]);
    expect(state.read).toHaveBeenLastCalledWith('navigation-targets');
    const requestCount = state.read.mock.calls.length;
    await store.loadNavigationTargets();
    expect(state.read).toHaveBeenCalledTimes(requestCount);
});

it.each(['reset','identity'] as const)('导航目标查询在 %s 后不接收迟到响应',async reason=>{
    let resolve!:(value:unknown[])=>void;
    state.read.mockReturnValueOnce(new Promise(done=>{resolve=done}));
    const store=useAdminNavigationTargetsStore();
    const pending=store.loadNavigationTargets();
    if(reason==='reset')store.reset();else state.session.generation++;
    resolve([{key:'late'}]);await pending;
    expect(store.navigationTargets).toEqual([]);
    expect(store.navigationTargetsPending).toBe(false);
    expect(store.navigationTargetsLoaded).toBe(false);
});

const failure = (code: string) => ({data:{success:false,error:{code,fields:[{message:'区块「业务介绍」：请先发布引用页面'},{message:'区块「业务介绍」：请先发布引用页面'}]}}});
it.each(['publish','restore','withdraw','delete'])('%s 失败返回详细 Toast，保留草稿和发布状态',async action=>{
    const page=fixture();
    if(action==='withdraw')page.publication={...page.publication,status:'published',publishedReleaseId:'release'};
    state.read.mockResolvedValue(page);
    const store=useAdminWebsitePagesStore();await store.enter('export');
    const before=JSON.stringify(store.draft);
    state.mutate.mockRejectedValue(failure('INVALID_INPUT'));
    const result=action==='delete'?await store.permanentlyRemove('export'):action==='restore'?await store.publish('release'):action==='withdraw'?await store.withdraw():await store.publish();
    expect(result).toEqual({status:'error',message:'区块「业务介绍」：请先发布引用页面'});
    expect(store.saveError).toBe('');expect(store.deletionError).toBe('');
    expect(JSON.stringify(store.draft)).toBe(before);expect(store.deleted).toBe(false);
});
it.each(['INVALID_INPUT','FORBIDDEN','CONFLICT','network'])('保存 %s 按错误类型分流且保留输入',async code=>{
    state.read.mockResolvedValue(fixture());const store=useAdminWebsitePagesStore();await store.enter('export');
    store.draft!.settings.sceneTransitionSeconds=0.8;
    state.mutate.mockRejectedValue(code==='network'?new Error('offline'):failure(code));
    const result=await store.save();
    if(code==='INVALID_INPUT'){expect(result).toBeNull();expect(store.saveError).toBe('区块「业务介绍」：请先发布引用页面')}
    else{expect(result?.status).toBe('error');expect(store.saveError).toBe('')}
    expect(store.draft!.settings.sceneTransitionSeconds).toBe(0.8);expect(store.dirty).toBe(true);
});
it('删除确认编码校验保留在弹窗且不发请求',async()=>{
    state.read.mockResolvedValue(fixture());const store=useAdminWebsitePagesStore();await store.enter('export');
    expect(await store.permanentlyRemove('wrong')).toBeNull();expect(store.deletionError).toBeTruthy();expect(state.mutate).not.toHaveBeenCalled();
});
