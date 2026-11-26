import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
import {computed,effectScope,ref,watch,type EffectScope} from 'vue'
const mock=vi.hoisted(()=>({read:vi.fn(),mutate:vi.fn(),confirm:vi.fn(),session:{generation:0,isRoot:true}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>({read:mock.read,mutate:mock.mutate,operationMessage:()=> '请求失败'})}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>mock.session}))
vi.mock('~/composables/admin/interaction/useAdminActionConfirm',()=>({useAdminActionConfirm:()=>({ask:mock.confirm,state:ref(null),settle:vi.fn()})}))
import {useRouteMaintenance} from '../../app/composables/admin/website/useRouteMaintenance'
let scope:EffectScope
const failure=(code:string,message:string)=>({data:{success:false,error:{code,fields:[{path:'routes',message}]},requestId:'test'}})
beforeEach(()=>{
 setActivePinia(createPinia())
 vi.clearAllMocks();mock.session.generation=0;mock.confirm.mockResolvedValue(true)
 vi.stubGlobal('ref',ref);vi.stubGlobal('computed',computed);vi.stubGlobal('watch',watch);vi.stubGlobal('useState',(_key:string,init:()=>unknown)=>ref(init()))
 mock.read.mockResolvedValue({modulePolicy:{version:1,policy:{enabled:{news:true,careers:true,inquiries:true},pages:{},templates:{}}},draft:[],online:[],pages:[],version:1,publishedReleaseId:null,releases:[],seo:[],publishedSeo:[]})
 scope=effectScope()
})
afterEach(()=>{scope.stop();vi.unstubAllGlobals()})
it('路由保存的字段错误留在弹窗，操作失败改成 Toast',async()=>{
 const ui=scope.run(()=>useRouteMaintenance())!;await ui.load();ui.newRoute()
 const editor=ui.contentProps.value.editor
 editor.form.value.slug='services'
 mock.mutate.mockRejectedValueOnce(failure('INVALID_INPUT','路径格式不正确'))
 await editor.save()
 expect(editor.error.value).toBe('路径格式不正确');expect(ui.toast.notification.value).toBeNull();expect(editor.editorOpen.value).toBe(true)
 mock.mutate.mockRejectedValueOnce(failure('CONFLICT','版本已变更'))
 await editor.save()
 expect(editor.error.value).toBe('');expect(ui.toast.notification.value).toEqual({message:'版本已变更',tone:'error'});expect(editor.form.value.slug).toBe('services')
})
it('发布被引用关系阻止时仅使用 Toast，不占用页面错误区域',async()=>{
 const ui=scope.run(()=>useRouteMaintenance())!;await ui.load()
 mock.mutate.mockRejectedValueOnce(failure('INVALID_INPUT','已发布导航仍引用此路由'))
 await ui.publish()
 expect(ui.toast.notification.value).toEqual({message:'已发布导航仍引用此路由',tone:'error'})
 expect(ui.view.value.saveError).toBe('')
})

it('一次保存路由及所有语言 SEO，失败时保留编辑内容',async()=>{
 const ui=scope.run(()=>useRouteMaintenance())!;await ui.load();ui.newRoute()
 const editor=ui.contentProps.value.editor
 editor.tree.value.pages=[{id:'123',key:'services',published:true}]
 editor.form.value.targetType='page';editor.form.value.resourceId='123';editor.form.value.slug='services'
 editor.seoEntry.value!.title='统一保存标题'
 mock.mutate.mockRejectedValueOnce(failure('INVALID_INPUT','OG 图片不可用'))
 await editor.save()
 expect(mock.confirm).not.toHaveBeenCalled()
 expect(mock.mutate).toHaveBeenCalledTimes(1)
 expect(mock.mutate.mock.calls[0]![2]).toMatchObject({action:'save',resourceId:'123',slug:'services',seo:expect.arrayContaining([expect.objectContaining({title:'统一保存标题'})])})
 expect(editor.editorOpen.value).toBe(true)
 expect(editor.seoEntry.value!.title).toBe('统一保存标题')
 mock.mutate.mockResolvedValueOnce({...editor.tree.value,version:2})
 await editor.save()
 expect(editor.editorOpen.value).toBe(false)
})
