import {beforeEach,expect,it,vi} from 'vitest'
import {reactive} from 'vue'
import {createPinia,setActivePinia} from 'pinia'
import {emptyNewsContent} from '../../shared/schemas/admin/news'
import {emptySiteText} from '../../shared/utils/admin/site-settings'
import type {NewsArticle} from '../../shared/types/admin/news'
const mocks=vi.hoisted(()=>({read:vi.fn(),mutate:vi.fn(),session:{generation:0,can:(permission:string)=>!!permission}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>({read:mocks.read,mutate:mocks.mutate,message:()=> '加载失败',operationMessage:()=> '保存失败'})}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>mocks.session}))
import {useAdminNewsStore} from '../../app/stores/admin/news'
const a=():NewsArticle=>({id:'2026110522000000001',slug:'test',viewCount:0,content:emptyNewsContent('2026110521000000001'),version:3,stateVersion:4,publishedReleaseId:'2026110523000000001',status:'published',changed:true,updatedAt:'',releases:[]})
beforeEach(()=>{setActivePinia(createPinia());mocks.session=reactive({generation:0,can:(permission:string)=>!!permission});mocks.read.mockReset();mocks.mutate.mockReset();mocks.read.mockImplementation(async(path:string)=>path==='news/articles'?{items:[a()],total:1,page:1,pageSize:20}:path==='news/categories'?[{id:'2026110521000000001',code:'test',name:{zh:'分类'},enabled:true}]:path==='news'?{draftVersion:3,stateVersion:2,publishedReleaseId:'2026110517000000001',status:'published'}:a())})
it('清理历史保留未保存正文和 dirty 基线，仅更新发布状态',async()=>{
 const store=useAdminNewsStore();await store.load();await store.edit(a().id)
 const next={...a(),stateVersion:5}
 mocks.mutate.mockResolvedValue({deleted:true});mocks.read.mockResolvedValue(next)
 await store.cleanupRelease(a(),'2026110523000000002')
 expect(store.dirty).toBe(false)
 store.draft!.content.localized.zh.title='保留输入'
 mocks.read.mockResolvedValue({...next,stateVersion:6})
 await store.cleanupRelease(next,'2026110523000000003')
 expect(store.dirty).toBe(true);expect(store.draft!.content.localized.zh.title).toBe('保留输入')
 expect(store.draft!.stateVersion).toBe(6)
 expect(mocks.mutate).toHaveBeenCalledWith('publication-history/cleanup','POST',expect.objectContaining({kind:'news',articleId:a().id,version:3,stateVersion:5}))
})
it('草稿保存只发送文章合同和草稿版本，不提交发布状态',async()=>{
 const store=useAdminNewsStore();await store.load();await store.edit(a().id);store.draft!.content.localized.zh.title='新标题';mocks.mutate.mockResolvedValue(a())
 expect(store.dirty).toBe(true);await store.save()
 expect(mocks.mutate).toHaveBeenCalledWith('news/articles/'+a().id,'PUT',{slug:'test',version:3,content:expect.objectContaining({localized:expect.objectContaining({zh:expect.objectContaining({title:'新标题'})})})})
 expect(store.draft).toBeNull()
})
it('发布提交三个并发凭据，恢复另带历史编号',async()=>{
 const store=useAdminNewsStore();mocks.mutate.mockResolvedValue(a());await store.action(a(),'restore','2026110523000000002')
 expect(mocks.mutate).toHaveBeenCalledWith('news/articles/'+a().id+'/restore','POST',{version:3,stateVersion:4,publishedReleaseId:'2026110523000000001',releaseId:'2026110523000000002'})
})
it('会话改变后丢弃迟到编辑响应',async()=>{
 const store=useAdminNewsStore();let resolve!:(value:NewsArticle)=>void;mocks.read.mockReturnValue(new Promise<NewsArticle>(r=>resolve=r));const task=store.edit(a().id);mocks.session.generation++;await Promise.resolve();resolve(a());await task
 expect(store.draft).toBeNull();expect(store.busy).toBe(false)
})
it('保存操作失败以 Toast 返回并保留输入和原版本',async()=>{
 const store=useAdminNewsStore();await store.edit(a().id);store.draft!.content.localized.zh.title='保留输入';mocks.mutate.mockRejectedValue(new Error('conflict'))
 expect(await store.save()).toEqual({status:'error',message:'保存失败'})
 expect(store.draft!.content.localized.zh.title).toBe('保留输入');expect(store.draft!.version).toBe(3);expect(store.saveError).toBe('')
})
it('新闻字段校验保留在编辑区域且不生成第二份 Toast',async()=>{
 const store=useAdminNewsStore();await store.edit(a().id)
 store.draft!.content.localized.zh.title='保留草稿'
 mocks.mutate.mockRejectedValue({data:{success:false,error:{code:'INVALID_INPUT',fields:[{path:'content.localized.en.title',message:'请填写英文标题'}]},requestId:'test'}})
 expect(await store.save()).toBeNull()
 expect(store.saveError).toBe('请填写英文标题')
 expect(store.draft!.content.localized.zh.title).toBe('保留草稿')
})
it('新闻后台加载不依赖任何新闻页面的发布状态',async()=>{
 const store=useAdminNewsStore();await store.load()
 expect(store.items).toHaveLength(1)
 expect(mocks.read).not.toHaveBeenCalledWith('news')
})
it('分类启停携带版本，失败时以 Toast 返回且不修改列表状态',async()=>{
 const store=useAdminNewsStore(),c={id:'2026110521000000001',code:'test',name:emptySiteText(),sortOrder:100,enabled:true,version:3};store.categories=[c]
 mocks.mutate.mockRejectedValue(new Error('referenced'));await store.setCategoryEnabled(c,false)
 expect(mocks.mutate).toHaveBeenCalledWith('news/categories','PUT',{id:c.id,code:'test',name:c.name,sortOrder:100,enabled:false,version:3})
 expect(store.categories[0]!.enabled).toBe(true)
 expect(store.saveError).toBe('')
})
it('行操作失败返回错误 Toast',async()=>{
 const store=useAdminNewsStore(),c={id:'2026110521000000001',code:'test',name:emptySiteText(),sortOrder:100,enabled:true,version:3};store.categories=[c]
 mocks.mutate.mockRejectedValue(new Error('referenced'))
 expect(await store.setCategoryEnabled(c,false)).toEqual({message:'保存失败',status:'error'})
})
it('写入成功但列表刷新失败时返回 warning，不用成功提示覆盖失败',async()=>{
 const store=useAdminNewsStore()
 mocks.mutate.mockResolvedValue(a())
 mocks.read.mockImplementation(async(path:string)=>{
  if(path==='news/articles')throw new Error('list unavailable')
  if(path==='news/categories')return[{id:'2026110521000000001',code:'test',name:{zh:'分类'},enabled:true}]
  if(path==='news')return{draftVersion:3,stateVersion:2,publishedReleaseId:'2026110517000000001',status:'published'}
  return a()
 })
 expect(await store.action(a(),'withdraw')).toEqual({message:'操作已完成，但列表刷新失败：加载失败',status:'warning'})
 expect(store.error).toBe('')
 expect(store.warning).toBe('列表待刷新')
})
it('历史发布读取失败返回错误 Toast，不写入表单错误',async()=>{
 const store=useAdminNewsStore()
 mocks.read.mockRejectedValue(new Error('history unavailable'))
 expect(await store.viewRelease(a(),'2026110523000000002')).toEqual({message:'保存失败',status:'error'})
 expect(store.saveError).toBe('')
})
it('分类移动携带相邻分类的版本，边界不发送请求',async()=>{
 const store=useAdminNewsStore(),first={id:'2026110521000000001',code:'one',name:emptySiteText(),sortOrder:100,enabled:true,version:3},second={...first,id:'2026110521000000002',code:'two',sortOrder:200,version:4};store.categories=[first,second]
 await store.moveCategory(first,'up');expect(mocks.mutate).not.toHaveBeenCalled()
 mocks.mutate.mockResolvedValue([]);await store.moveCategory(second,'up')
 expect(mocks.mutate).toHaveBeenCalledWith('news/categories/'+second.id+'/move','POST',{version:4,neighborId:first.id,neighborVersion:3,direction:'up'})
})
it('确认分类只更新本地列表，由服务端按启用语言校验保存',async()=>{
 const store=useAdminNewsStore()
 store.editCategory()
 store.categoryDraft!.code='new-category'
 store.categoryDraft!.name.zh='新分类'
 store.confirmCategory()
 expect(store.categoryDraft).toBeNull()
 expect(store.categoryDirty).toBe(true)
 expect(mocks.mutate).not.toHaveBeenCalled()
 store.editCategory(store.categoryEntries[0]!.key)
 const name={zh:'新分类',en:'New',fr:'Nouveau',es:'Nuevo',pt:'Novo'}
 store.categoryDraft!.name=name
 store.confirmCategory()
 mocks.mutate.mockResolvedValue({id:'2026110521000000002',code:'new-category',name,sortOrder:0,enabled:true,version:1})
 await store.saveCategories()
 expect(mocks.mutate).toHaveBeenCalledWith('news/categories','PUT',{id:null,code:'new-category',name,sortOrder:0,enabled:true})
 expect(store.categoryDirty).toBe(false)
})
