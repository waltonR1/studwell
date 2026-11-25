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
