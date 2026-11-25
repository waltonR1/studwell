import {beforeEach, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {reactive, nextTick} from 'vue'
const state=vi.hoisted(()=>({read:vi.fn(),upload:vi.fn(),session:{generation:0,can:(permission:string)=>!!permission}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>({read:state.read,upload:state.upload,message:()=> '加载失败',operationMessage:()=> '上传失败'})}))
vi.mock('~/stores/admin/session',()=>({useAdminSessionStore:()=>state.session}))
import {useAdminMediaSelectionStore} from '../../app/stores/admin/media-selection'
import {MEDIA_MAX_BYTES,VIDEO_MAX_BYTES} from '../../shared/config/admin/media'
import {mediaQuerySchema} from '../../shared/schemas/admin/media'
import {withQuery} from 'ufo'
beforeEach(()=>{setActivePinia(createPinia());state.session=reactive({generation:0,can:(permission:string)=>!!permission});state.read.mockReset();state.upload.mockReset()})
it('混合媒体入口不限制列表类型，上传分别遵守图片和视频大小限制',async()=>{
 const store=useAdminMediaSelectionStore()
 state.read.mockResolvedValue({items:[{id:'image',kind:'image'},{id:'video',kind:'video'}],total:2})
 await store.load('banner',1,'any')
 expect(state.read.mock.calls[0]![1]).not.toHaveProperty('kind')
 expect(store.selection('banner').items).toHaveLength(2)
 state.upload.mockResolvedValueOnce({id:'video',kind:'video'}).mockResolvedValueOnce({id:'image',kind:'image'})
 expect(await store.upload('banner',{name:'clip.mp4',type:'video/mp4',size:MEDIA_MAX_BYTES+1} as File,'any')).toMatchObject({kind:'video'})
 expect(await store.upload('banner',{name:'cover.png',type:'image/png',size:100} as File,'any')).toMatchObject({kind:'image'})
 expect(await store.upload('banner',{name:'large.png',type:'image/png',size:MEDIA_MAX_BYTES+1} as File,'any')).toBeNull()
 expect(await store.upload('banner',{name:'large.mp4',type:'video/mp4',size:VIDEO_MAX_BYTES+1} as File,'any')).toBeNull()
 expect(state.upload).toHaveBeenCalledTimes(2)
})
it('类型筛选复用列表查询，全部类型不传 kind，分页及关键词可通过服务端校验',async()=>{
 const store=useAdminMediaSelectionStore()
 state.read.mockImplementation(async(_path,query)=>{
  const url=new URL(withQuery('http://localhost/api/admin/media',query))
  const parsed=mediaQuerySchema.parse(Object.fromEntries(url.searchParams))
  return {items:[],total:0,page:parsed.page,pageSize:parsed.pageSize}
 })
 store.selection('banner').search='企业'
 for(const kind of ['video','image','any'] as const){
  await store.load('banner',kind==='video'?2:1,kind)
  expect(store.selection('banner').error).toBe('')
  const query=state.read.mock.calls.at(-1)![1]
  expect(query.search).toBe('企业')
  if(kind==='any')expect(query).not.toHaveProperty('kind')
  else expect(query.kind).toBe(kind)
 }
})
it('两个选图作用域查询互不覆盖，关闭后迟到响应丢弃',async()=>{
 const store=useAdminMediaSelectionStore()
 let finish!:(value:unknown)=>void
 state.read.mockReturnValueOnce(new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce({items:[{id:'favicon'}],total:1})
 const pending=store.load('logoId');await store.load('faviconId')
 store.leave('logoId');finish({items:[{id:'logo'}],total:1});await pending
 expect(store.selection('logoId').items).toEqual([])
 expect(store.selection('faviconId').items[0]!.id).toBe('favicon')
 state.session.generation++;await nextTick();expect(store.selection('faviconId').items).toEqual([])
})

it('上传复用媒体接口，进度隔离；失败保留错误，成功返回可选用媒体',async()=>{
 const store=useAdminMediaSelectionStore(),file={name:'cover.png',type:'image/png',size:100} as File
 state.upload.mockImplementationOnce(async(_path,_file,_fields,progress)=>{progress(70);expect(store.selection('cover').progress).toBe(70);return {id:'image',kind:'image'}})
 expect(await store.upload('cover',file)).toMatchObject({id:'image',kind:'image'})
 expect(state.upload).toHaveBeenCalledWith('media',file,{filename:'cover.png'},expect.any(Function))
 expect(store.selection('cover').uploading).toBe(false)
 expect(store.selection('faviconId').progress).toBe(0)
 state.upload.mockRejectedValueOnce(new Error())
 expect(await store.upload('cover',file)).toBeNull()
 expect(store.selection('cover').uploadError).toBe('上传失败')
})
it('上传受权限、类型、大小及重复提交约束，关闭后丢弃迟到响应',async()=>{
 const store=useAdminMediaSelectionStore(),file={name:'cover.png',type:'image/png',size:100} as File
 state.session.can=permission=>permission!=='content.media.create'
 expect(await store.upload('cover',file)).toBeNull()
 state.session.can=()=>true
 expect(await store.upload('cover',{...file,size:11*1024*1024} as File)).toBeNull()
 expect(await store.upload('cover',{...file,type:'video/mp4',name:'clip.mp4'} as File)).toBeNull()
 expect(await store.upload('cover',file,'video')).toBeNull()
 expect(state.upload).not.toHaveBeenCalled()
 let finish!:(value:unknown)=>void
 state.upload.mockReturnValueOnce(new Promise(resolve=>{finish=resolve}))
 const pending=store.upload('cover',file)
 expect(await store.upload('cover',file)).toBeNull()
 store.leave('cover');finish({id:'late',kind:'image'})
 expect(await pending).toBeNull()
 expect(store.selection('cover').uploading).toBe(false)
})
