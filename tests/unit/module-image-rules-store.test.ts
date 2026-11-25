// 检查图片规则查询的权限、共享请求、重试与身份隔离。
import {beforeEach,expect,it,vi} from 'vitest'
import {reactive} from 'vue'
import {createPinia,setActivePinia} from 'pinia'
import {useAdminModuleImageRulesStore} from '../../app/stores/admin/module-image-rules'
const mock=vi.hoisted(()=>({read:vi.fn(),session:{generation:0,allowed:true,can:()=>true}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>({read:mock.read,operationMessage:()=> '读取失败'})}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>mock.session}))
beforeEach(()=>{
 setActivePinia(createPinia());mock.read.mockReset()
 mock.session=reactive({generation:0,allowed:true,can:()=>mock.session.allowed})
})
const rules={logo:{key:'logo'},favicon:{key:'favicon'},newsCover:{key:'cover'},newsBody:{key:'body'}}
it('无媒体读取权限不请求；失败提供错误并允许重试',async()=>{
 const store=useAdminModuleImageRulesStore();mock.session.allowed=false
 await store.load();expect(mock.read).not.toHaveBeenCalled()
 mock.session.allowed=true;mock.read.mockRejectedValueOnce(new Error('offline'))
 await store.load();expect(store.error).toBe('读取失败');expect(store.rules).toBeUndefined()
 mock.read.mockResolvedValueOnce(rules);await store.load(true)
 expect(store.rules).toEqual(rules);expect(store.error).toBe('');expect(store.pending).toBe(false)
 expect(mock.read).toHaveBeenLastCalledWith('media/image-rules')
})
it('多个使用者共享请求和缓存，最后一个退出后清理',async()=>{
 const store=useAdminModuleImageRulesStore();store.acquire();store.acquire()
 let done!:(value:unknown)=>void;mock.read.mockReturnValueOnce(new Promise(resolve=>{done=resolve}))
 const loading=store.load();await store.load();expect(mock.read).toHaveBeenCalledTimes(1)
 done(rules);await loading;await store.load();expect(mock.read).toHaveBeenCalledTimes(1)
 store.release();expect(store.rules).toEqual(rules)
 store.release();expect(store.rules).toBeUndefined()
})
it.each(['identity','permission','release'] as const)('%s 后丢弃旧请求响应',async reason=>{
 const store=useAdminModuleImageRulesStore();store.acquire()
 let done!:(value:unknown)=>void;mock.read.mockReturnValueOnce(new Promise(resolve=>{done=resolve}))
 const loading=store.load()
 if(reason==='identity')mock.session.generation++
 else if(reason==='permission')mock.session.allowed=false
 else store.release()
 done(rules);await loading
 expect(store.rules).toBeUndefined();expect(store.pending).toBe(false);expect(store.error).toBe('')
})
