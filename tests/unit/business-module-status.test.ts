import {beforeEach, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {effectScope,ref} from 'vue'
import type {SiteModuleName} from '../../shared/config/site-modules'
import {useAdminSessionStore} from '../../app/stores/admin/session'
const transport = vi.hoisted(() => ({read: vi.fn(), mutate: vi.fn(), operationMessage: () => '模块仍被已发布页面使用'}))
vi.mock('~/stores/admin/request', () => ({useAdminRequestStore: () => transport}))
import {useBusinessModuleStatus} from '../../app/composables/admin/useBusinessModuleStatus'
const record = {module: 'news', name: '新闻', enabled: true, version: 3, usages: [{key: 'home', name: '首页', sectionNames: ['最新新闻']}]}
function login(permissions: string[], isRoot=false) {
    const session = useAdminSessionStore()
    session.acceptSession({authenticated: true, mustChangePassword: false, user: {id: '1', username: 'editor', displayName: 'Editor', isRoot}, csrfToken: 'token'}, session.generation)
    session.acceptPermissions({isRoot, permissions, version: '1'}, session.generation)
    return session
}
beforeEach(() => {setActivePinia(createPinia()); transport.read.mockReset(); transport.mutate.mockReset()})
it('read-only users see status and usage without being able to change it', async () => {
    login(['content.news.read'])
    transport.read.mockResolvedValue(record)
    const scope = effectScope(), ui = scope.run(() => useBusinessModuleStatus('news'))!
    await ui.load(); await ui.toggle()
    expect(ui.state.value?.usages[0]?.name).toBe('首页')
    expect(ui.canUpdate.value).toBe(false)
    expect(transport.mutate).not.toHaveBeenCalled()
    scope.stop()
})
it('clears previous identity immediately and discards late responses', async () => {
    const session = login(['content.news.read'])
    let resolve!: (value: typeof record) => void
    transport.read.mockReturnValue(new Promise(done => {resolve = done}))
    const scope = effectScope(), ui = scope.run(() => useBusinessModuleStatus('news'))!
    const loading = ui.load()
    session.resetIdentity('logout')
    expect(ui.state.value).toBeNull()
    resolve(record); await loading
    expect(ui.state.value).toBeNull()
    expect(ui.pending.value).toBe(false)
    scope.stop()
})
it('submits the loaded version and refreshes usage after a rejected disable', async () => {
    login(['content.news.read', 'content.modules.update'],true)
    transport.read.mockResolvedValue(record)
    transport.mutate.mockRejectedValue(new Error('conflict'))
    const scope = effectScope(), ui = scope.run(() => useBusinessModuleStatus('news'))!
    await ui.load(); await ui.toggle()
    expect(transport.mutate).toHaveBeenCalledWith('site-modules/news', 'PUT', {version: 3, enabled: false})
    expect(transport.read).toHaveBeenCalledTimes(2)
    expect(ui.state.value?.enabled).toBe(true)
    expect(ui.notification.value).toEqual({tone:'error',message:expect.stringContaining('已发布页面')})
    expect(ui.error.value).toBe('')
    expect(ui.saving.value).toBe(false)
    scope.stop()
})
it('business editors cannot toggle modules', async()=>{
    login(['content.news.read','content.news.operations.update','content.modules.update'])
    transport.read.mockResolvedValue(record)
    const scope=effectScope(),ui=scope.run(()=>useBusinessModuleStatus('news'))!
    await ui.load();await ui.toggle()
    expect(ui.canUpdate.value).toBe(false)
    expect(transport.mutate).not.toHaveBeenCalled()
    scope.stop()
})
it('reference blockers use a short Toast and expose the persistent usage list',async()=>{
    login(['content.news.read','content.modules.update'],true)
    transport.read.mockResolvedValue(record)
    transport.mutate.mockRejectedValue({data:{success:false,error:{code:'CONFLICT',reason:'REFERENCED',fields:[{path:'enabled',message:'新闻中心仍然引用新闻业务'}]},requestId:'test'}})
    const scope=effectScope(),ui=scope.run(()=>useBusinessModuleStatus('news'))!
    await ui.load();await ui.toggle()
    expect(ui.notification.value).toEqual({tone:'error',message:'新闻仍被 1 个已发布页面使用，请先处理引用。'})
    expect(ui.blockedByReferences.value).toBe(true)
    expect(ui.error.value).toBe('')
    expect(ui.state.value?.usages).toHaveLength(1)
    scope.stop()
})
it('initial load failures stay inline without producing an operation Toast',async()=>{
    login(['content.news.read'])
    transport.read.mockRejectedValue(new Error('offline'))
    const scope=effectScope(),ui=scope.run(()=>useBusinessModuleStatus('news'))!
    await ui.load()
    expect(ui.error.value).toBeTruthy()
    expect(ui.notification.value).toBeNull()
    scope.stop()
})
it('a late module failure cannot notify a different identity',async()=>{
    const session=login(['content.news.read','content.modules.update'],true)
    transport.read.mockResolvedValue(record)
    let reject!:(reason:unknown)=>void
    transport.mutate.mockReturnValue(new Promise((_resolve,fail)=>{reject=fail}))
    const scope=effectScope(),ui=scope.run(()=>useBusinessModuleStatus('news'))!
    await ui.load();const action=ui.toggle()
    session.resetIdentity('logout');reject(new Error('conflict'));await action
    expect(ui.notification.value).toBeNull();expect(ui.blockedByReferences.value).toBe(false)
    expect(ui.state.value).toBeNull()
    scope.stop()
})

it('different modules retain independent state when another row leaves',async()=>{
    login([],true)
    transport.read.mockImplementation(async(path:string)=>path.endsWith('/news')?record:{...record,module:'careers',name:'招聘'})
    const first=effectScope(),second=effectScope()
    const news=first.run(()=>useBusinessModuleStatus('news'))!,careers=second.run(()=>useBusinessModuleStatus('careers'))!
    await Promise.all([news.load(),careers.load()]);first.stop()
    expect(careers.state.value?.module).toBe('careers');expect(news.state.value).toBeNull()
    second.stop()
})
it('one consumer leaving does not clear another consumer of the same module',async()=>{
    login([],true);transport.read.mockResolvedValue(record)
    const first=effectScope(),second=effectScope()
    const one=first.run(()=>useBusinessModuleStatus('news'))!,two=second.run(()=>useBusinessModuleStatus('news'))!
    await one.load();first.stop()
    expect(two.state.value?.version).toBe(3)
    second.stop();expect(two.state.value).toBeNull()
})
it('changing selected module rejects the previous module response',async()=>{
    login([],true)
    let resolve!:(value:typeof record)=>void
    transport.read.mockReturnValueOnce(new Promise(done=>{resolve=done}))
    const selected=ref<SiteModuleName>('news'),scope=effectScope(),ui=scope.run(()=>useBusinessModuleStatus(selected))!
    const loading=ui.load();selected.value='careers';resolve(record);await loading
    expect(ui.state.value).toBeNull();expect(ui.pending.value).toBe(false)
    transport.read.mockResolvedValue({...record,module:'careers'});await ui.load()
    expect(ui.state.value?.module).toBe('careers');scope.stop()
})
it('a disposed operation cannot notify a remaining consumer',async()=>{
    login([],true);transport.read.mockResolvedValue(record)
    const first=effectScope(),second=effectScope()
    const one=first.run(()=>useBusinessModuleStatus('news'))!,two=second.run(()=>useBusinessModuleStatus('news'))!
    await one.load()
    let resolve!:(value:typeof record)=>void
    transport.mutate.mockReturnValueOnce(new Promise(done=>{resolve=done}))
    const action=one.toggle();first.stop();resolve({...record,enabled:false});await action
    expect(one.notification.value).toBeNull();expect(two.notification.value).toBeNull()
    expect(two.state.value?.enabled).toBe(false);second.stop()
})
