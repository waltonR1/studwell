import {beforeEach,expect,it,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
import {reactive,nextTick} from 'vue'
import {templateDefinition} from '../fixtures/reference/template-catalog'
import type {WebsiteTemplateRecord} from '../../shared/types/admin/website'
const state=vi.hoisted(()=>({read:vi.fn(),mutate:vi.fn(),session:{generation:0,can:()=>true}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>({read:state.read,mutate:state.mutate,message:()=> '加载失败',operationMessage:()=> '操作失败'})}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>state.session}))
import {useAdminWebsiteTemplatesStore} from '../../app/stores/admin/website-templates'
const fixture=():WebsiteTemplateRecord=>({id:'2026103119000000001',key:'home.hero',name:'首屏',description:'说明',coverMediaId:'2026103114000000001',enabledForNew:true,metadataVersion:4,definition:templateDefinition('home.hero')!})
beforeEach(()=>{setActivePinia(createPinia());state.session=reactive({generation:0,can:()=>true});state.read.mockReset().mockResolvedValue([fixture()]);state.mutate.mockReset()})
it('列表启停保留名称说明封面，使用当前资料版本，失败不翻转状态',async()=>{
 const store=useAdminWebsiteTemplatesStore();await store.load()
 state.mutate.mockRejectedValueOnce(new Error())
 expect(await store.setEnabled(fixture().id,false)).toMatchObject({status:'error',message:'操作失败'})
 expect(store.items[0]!.enabledForNew).toBe(true)
 state.mutate.mockResolvedValueOnce([{...fixture(),enabledForNew:false,metadataVersion:5}])
 expect(await store.setEnabled(fixture().id,false)).toMatchObject({status:'success'})
 expect(state.mutate).toHaveBeenLastCalledWith('website-templates/'+fixture().id,'PUT',{version:4,name:'首屏',description:'说明',coverMediaId:fixture().coverMediaId,enabledForNew:false})
 expect(store.items[0]).toMatchObject({enabledForNew:false,metadataVersion:5})
 expect(store.draft).toBeNull()
})
it('无权限、编辑中或未注册定义不允许列表启用',async()=>{
 const store=useAdminWebsiteTemplatesStore();await store.load();state.session.can=()=>false
 expect(await store.setEnabled(fixture().id,false)).toBeNull()
 state.session.can=()=>true;store.edit(fixture().id)
 expect(await store.setEnabled(fixture().id,false)).toBeNull()
 store.close();store.items[0]!.definition=null;store.items[0]!.enabledForNew=false
 expect(await store.setEnabled(fixture().id,true)).toBeNull()
 expect(state.mutate).not.toHaveBeenCalled()
})
it('保存期间不重复提交，会话切换丢弃旧状态响应',async()=>{
 const store=useAdminWebsiteTemplatesStore();await store.load();let finish!:(value:unknown)=>void
 state.mutate.mockReturnValueOnce(new Promise(resolve=>{finish=resolve}))
 const saving=store.setEnabled(fixture().id,false)
 expect(await store.setEnabled(fixture().id,false)).toBeNull();expect(state.mutate).toHaveBeenCalledTimes(1)
 state.session.generation++;await nextTick();finish([{...fixture(),enabledForNew:false}])
 expect(await saving).toBeNull();expect(store.items).toEqual([])
})
it('只允许使用当前资料版本删除历史保留记录',async()=>{
 const store=useAdminWebsiteTemplatesStore(),historical={...fixture(),key:'fixture.history',name:'历史模板',enabledForNew:false,definition:null}
 state.read.mockResolvedValueOnce([historical]);await store.load()
 state.mutate.mockResolvedValueOnce([])
 expect(await store.remove(historical.id)).toMatchObject({status:'success',message:'模板已删除，其他内容保持不变。'})
 expect(state.mutate).toHaveBeenLastCalledWith('website-templates/'+historical.id,'DELETE',{version:historical.metadataVersion})
 expect(store.items).toEqual([])
 state.mutate.mockClear();state.read.mockResolvedValueOnce([fixture()]);await store.load()
 expect(await store.remove(fixture().id)).toMatchObject({status:'error'})
 expect(state.mutate).not.toHaveBeenCalled()
})
it('登记只导入合法初始定义，提交路径和定义，已有模板维护追加修订',async()=>{
 const store=useAdminWebsiteTemplatesStore();await store.load();store.configure()
 store.importDefinition('not json');expect(store.configurationError).toBeTruthy()
 store.importDefinition(JSON.stringify(fixture().definition));expect(store.configuration!.definition).not.toBeNull()
 store.configuration!.publicComponentPath='app/components/public/sections/common/TextContent.vue'
 state.mutate.mockResolvedValueOnce([fixture()])
 expect(await store.saveConfiguration()).toMatchObject({status:'success'})
 expect(state.mutate).toHaveBeenLastCalledWith('website-templates','POST',expect.objectContaining({publicComponentPath:'app/components/public/sections/common/TextContent.vue',previewComponentPath:'app/components/public/sections/common/TextContent.vue'}))
 store.items[0]!.revision=2;store.configure(fixture().id)
 store.configuration!.definition!.category='新分类'
 state.mutate.mockResolvedValueOnce([{...fixture(),revision:3}])
 expect(await store.saveConfiguration()).toMatchObject({status:'success'})
 expect(state.mutate).toHaveBeenLastCalledWith('website-templates/'+fixture().id+'/configuration','PUT',expect.objectContaining({version:4,revision:2}))
})
it('配置保存失败保留输入，会话切换后迟到响应不会回填',async()=>{
 const store=useAdminWebsiteTemplatesStore();await store.load();store.configure(fixture().id)
 store.configuration!.definition!.category='保留修改'
 state.mutate.mockRejectedValueOnce(new Error('failed'))
 expect(await store.saveConfiguration()).toBeNull();expect(store.configuration!.definition!.category).toBe('保留修改')
 expect(store.configurationError).toBe('操作失败')
 let resolve!:(value:unknown)=>void;state.mutate.mockReturnValueOnce(new Promise(r=>resolve=r))
 const task=store.saveConfiguration();state.session.generation++;await nextTick();resolve([fixture()]);await task
 expect(store.items).toEqual([]);expect(store.configuration).toBeNull()
})
