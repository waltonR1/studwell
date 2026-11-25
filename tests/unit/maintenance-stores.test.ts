// 维护业务状态独立于界面：检查发布契约、草稿基线及身份变更后的异步隔离。
import {beforeEach,expect,it,vi} from 'vitest'
import {reactive} from 'vue'
import {createPinia,setActivePinia} from 'pinia'
import {defaultSiteLanguages} from '../../shared/config/site-languages'
import {useAdminSiteLanguagesStore} from '../../app/stores/admin/site-languages'
import {useAdminWebsiteRoutesStore} from '../../app/stores/admin/website-routes'
const mock=vi.hoisted(()=>({read:vi.fn(),mutate:vi.fn(),session:{generation:0,isRoot:true}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>({read:mock.read,mutate:mock.mutate,operationMessage:()=> '请求失败'})}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>mock.session}))
beforeEach(()=>{setActivePinia(createPinia());vi.clearAllMocks();mock.session=reactive({generation:0,isRoot:true})})
const languageState=()=>({languages:structuredClone(defaultSiteLanguages),publishedLanguages:structuredClone(defaultSiteLanguages),version:4,publishedReleaseId:null,releases:[]})
const routeState=()=>({modulePolicy:{version:1,policy:{enabled:{news:true,careers:true,inquiries:true},pages:{},templates:{}}},draft:[],online:[],pages:[],version:7,publishedReleaseId:null,releases:[],seo:[],publishedSeo:[]})
it('保存语言草稿不触发发布，发布只携带语言版本',async()=>{
 const initial=languageState();mock.read.mockResolvedValue(initial)
 const store=useAdminSiteLanguagesStore();await store.load()
 store.form.defaultLocale='zh';expect(store.dirty).toBe(true)
 mock.mutate.mockResolvedValueOnce({...initial,languages:{...initial.languages,defaultLocale:'zh'},version:5})
 expect(await store.save()).toMatchObject({status:'success'})
 expect(store.dirty).toBe(false)
 expect(mock.mutate).toHaveBeenLastCalledWith('site-languages','PUT',expect.objectContaining({version:4,languages:expect.objectContaining({defaultLocale:'zh'})}))
 mock.mutate.mockResolvedValueOnce({version:6});mock.read.mockResolvedValue({...initial,version:6})
 await store.publish('123')
 expect(mock.mutate).toHaveBeenLastCalledWith('site-languages/publish','POST',{version:5,publishedReleaseId:null,releaseId:'123'})
})
it.each(['languages','routes'] as const)('%s 离开或身份切换后拒绝迟到的读取和错误',async kind=>{
 const store=kind==='languages'?useAdminSiteLanguagesStore():useAdminWebsiteRoutesStore()
 let done!:(value:unknown)=>void
 mock.read.mockReturnValueOnce(new Promise(resolve=>{done=resolve}))
 const loading=store.load();mock.session.generation++
 done(kind==='languages'?languageState():routeState());await loading
 expect(store.record).toBeNull();expect(store.loading).toBe(false)
 let fail!:(cause:unknown)=>void
 mock.read.mockReturnValueOnce(new Promise((_resolve,reject)=>{fail=reject}))
 const retry=store.load();store.reset();fail(new Error('late'));await retry
 expect(store.loadError).toBe('');expect(store.record).toBeNull()
})
it('路由保存使用路由版本，身份切换后不返回成功通知或恢复旧草稿',async()=>{
 mock.read.mockResolvedValue(routeState());const store=useAdminWebsiteRoutesStore();await store.load();store.select();store.form.slug='custom'
 let done!:(value:unknown)=>void;mock.mutate.mockReturnValueOnce(new Promise(resolve=>{done=resolve}))
 const saving=store.save();expect(mock.mutate).toHaveBeenCalledWith('website-routes','PUT',{action:'save',version:7,id:null,parentId:null,slug:'custom',targetType:'group',resourceId:null})
 mock.session.generation++;done(routeState())
 expect(await saving).toBeNull();expect(store.record).toBeNull();expect(store.form.slug).toBe('');expect(store.busy).toBe(false)
})
