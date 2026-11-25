import {beforeEach,describe,expect,it,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
const dependencies=vi.hoisted(()=>({api:{list:vi.fn(),upload:vi.fn(),update:vi.fn(),remove:vi.fn()},request:{message:(error:Error)=>error.message,operationMessage:(error:Error)=>error.message}}))
vi.mock('~/stores/admin/request',()=>({useAdminRequestStore:()=>dependencies.request}))
vi.mock('~/api/admin/media',()=>({createMediaApi:()=>dependencies.api}))
import type {MediaRecord} from '../../shared/types/admin/media'
import {useAdminMediaStore} from '../../app/stores/admin/media'
const empty={items:[],total:0,page:1,pageSize:20}
beforeEach(()=>{setActivePinia(createPinia());vi.clearAllMocks()})
describe('媒体查询与离开保护',()=>{
    it('分页只使用已提交搜索和筛选，不混入输入草稿',async()=>{
        const store=useAdminMediaStore();dependencies.api.list.mockResolvedValue(empty)
        const query={search:'已查询',kind:'image',page:2,pageSize:20}
        await store.load(query);query.search='新输入';await store.load();
        expect(dependencies.api.list).toHaveBeenLastCalledWith({search:'已查询',kind:'image',page:2,pageSize:20})
    })
    it('列表请求失败独立于编辑反馈，重试成功后清除列表错误',async()=>{
        const store=useAdminMediaStore();dependencies.api.list.mockRejectedValueOnce(new Error('列表读取失败'))
        await store.load()
        expect(store.loadError).toBe('列表读取失败');expect(store.error).toBe('')
        dependencies.api.list.mockResolvedValueOnce(empty);await store.load()
        expect(store.loadError).toBe('');expect(store.pending).toBe(false)
    })
    it('多文件逐项失败不阻断后续，重试只处理失败项',async()=>{
        dependencies.api.list.mockResolvedValue(empty);
        dependencies.api.upload.mockRejectedValueOnce(new Error('网络失败')).mockResolvedValueOnce({id:'2'}).mockResolvedValueOnce({id:'1'});
        const store=useAdminMediaStore();await store.uploadFiles([new File(['a'],'a.png'),new File(['b'],'b.png')]);
        expect(store.uploads.map(row=>row.state)).toEqual(['failed']);
        await store.retryUpload(store.uploads[0]!.id);
        expect(store.uploads).toEqual([]);expect(dependencies.api.upload).toHaveBeenCalledTimes(3);
    })
    it('离开后迟到的上传不重新打开编辑器',async()=>{
        let resolve!:(value:object)=>void
        dependencies.api.upload.mockImplementation(()=>new Promise(done=>{resolve=done}))
        const store=useAdminMediaStore(),uploading=store.upload(new File(['fixture'],'test.png',{type:'image/png'}))
        store.leave();resolve({id:'2026102914000000001'});await uploading
        expect(store.editor).toBeNull();expect(store.busy).toBe(false);expect(dependencies.api.list).not.toHaveBeenCalled()
    })
})

const media = (id: string, references: MediaRecord['references'] = []) => ({id, name: id, version: 1, references} as MediaRecord)
it('删除成功后在列表刷新期间保留其他行，刷新失败也不恢复已删除行', async () => {
    const removed = media('1'), remaining = media('2')
    let failRefresh!: (error: Error) => void
    dependencies.api.list
        .mockResolvedValueOnce({...empty, items: [removed, remaining], total: 2})
        .mockImplementationOnce(() => new Promise((_, reject) => { failRefresh = reject }))
    dependencies.api.remove.mockResolvedValueOnce({deleted: true})
    const store = useAdminMediaStore()
    await store.load()
    const deleting = store.remove(removed)
    await vi.waitFor(() => expect(store.pending).toBe(true))
    expect(store.result.items).toEqual([remaining])
    expect(store.result.total).toBe(1)
    failRefresh(new Error('列表读取失败'))
    await deleting
    expect(store.result.items).toEqual([remaining])
    expect(store.feedback?.status).toBe('warning')
})

describe('媒体批量删除', () => {
    it('跳过已引用媒体，单项失败继续处理，最后只刷新一次', async () => {
        dependencies.api.list.mockResolvedValue(empty)
        dependencies.api.remove.mockRejectedValueOnce(new Error('正在被引用')).mockResolvedValueOnce({deleted:true})
        const store=useAdminMediaStore()
        await store.removeMany([media('1'),media('2'),media('3',[{owner:'文章',field:'封面',source:'测试文章',status:'草稿',location:'文章封面',locationKey:'cover',locale:null}])])
        expect(dependencies.api.remove.mock.calls).toEqual([['1',1],['2',1]])
        expect(store.deletions.map(row=>row.state)).toEqual(['failed','success'])
        expect(store.deletions[0]?.error).toBe('正在被引用')
        expect(store.notice).toContain('成功 1 项，失败 1 项')
        expect(store.feedback).toEqual({message:store.notice,status:'warning'})
        expect(dependencies.api.list).toHaveBeenCalledTimes(1)
    })
    it('权限失效停止后续删除', async () => {
        dependencies.api.list.mockResolvedValue(empty)
        dependencies.api.remove.mockRejectedValueOnce(Object.assign(new Error('无权限'),{statusCode:403}))
        const store=useAdminMediaStore()
        await store.removeMany([media('1'),media('2')])
        expect(dependencies.api.remove).toHaveBeenCalledTimes(1)
        expect(store.deletions.map(row=>row.state)).toEqual(['failed','failed'])
    })
    it('离开页面后不继续删除或刷新列表', async () => {
        let resolve!:(value:object)=>void
        dependencies.api.remove.mockImplementationOnce(()=>new Promise(done=>{resolve=done}))
        const store=useAdminMediaStore(), removing=store.removeMany([media('1'),media('2')])
        store.leave();resolve({deleted:true});await removing
        expect(dependencies.api.remove).toHaveBeenCalledTimes(1)
        expect(dependencies.api.list).not.toHaveBeenCalled()
        expect(store.deletions).toEqual([])
        expect(store.feedback).toBeNull()
    })
})

describe('媒体操作提示', () => {
    it('全部删除成功使用成功 Toast，刷新失败保留已删除事实并警告', async () => {
        dependencies.api.remove.mockResolvedValue({deleted:true})
        dependencies.api.list.mockResolvedValueOnce(empty).mockRejectedValueOnce(new Error('列表读取失败'))
        const store=useAdminMediaStore()
        await store.removeMany([media('1')])
        expect(store.feedback?.status).toBe('success')
        await store.removeMany([media('2')])
        expect(store.feedback?.status).toBe('warning')
        expect(store.feedback?.message).toContain('成功 1 项')
        expect(store.feedback?.message).toContain('列表刷新失败')
    })
})

describe('列表中的上传临时行', () => {
    it('刷新成功后移除成功临时行，保留失败项并正确汇总', async () => {
        dependencies.api.list.mockResolvedValue(empty)
        dependencies.api.upload.mockResolvedValueOnce({id:'1'}).mockRejectedValueOnce(new Error('上传失败'))
        const store=useAdminMediaStore()
        await store.uploadFiles([new File(['a'],'a.png'),new File(['b'],'b.png')])
        expect(store.uploads.map(item=>item.state)).toEqual(['failed'])
        expect(store.feedback).toEqual({message:'上传完成：成功 1 项，失败 1 项。',status:'warning'})
        store.removeFailedUpload(store.uploads[0]!.id)
        expect(store.uploads).toEqual([])
    })
    it('刷新失败保留已上传状态，再次刷新后移除且不重复上传', async () => {
        dependencies.api.list.mockRejectedValueOnce(new Error('网络失败')).mockResolvedValueOnce(empty)
        dependencies.api.upload.mockResolvedValue({id:'1'})
        const store=useAdminMediaStore()
        await store.upload(new File(['a'],'a.png'))
        expect(store.uploads[0]?.state).toBe('success')
        expect(store.feedback?.status).toBe('warning')
        await store.load()
        expect(store.uploads).toEqual([])
        expect(dependencies.api.upload).toHaveBeenCalledTimes(1)
    })
})

describe('上传行与正式记录合并', () => {
    it('上传成功立即成为正式行，刷新前后按 ID 去重且保持行标识', async () => {
        const record=media('42')
        let finish!:(value:object)=>void
        dependencies.api.upload.mockResolvedValueOnce(record).mockImplementationOnce(()=>new Promise(done=>{finish=done}))
        dependencies.api.list.mockResolvedValue({items:[record],total:1,page:1,pageSize:20})
        const store=useAdminMediaStore()
        const pending=store.uploadFiles([new File(['a'],'a.png'),new File(['b'],'b.png')])
        await vi.waitFor(()=>expect(store.uploads[1]?.state).toBe('uploading'))
        expect(store.rows[0]?.record?.id).toBe('42')
        const key=store.rows[0]!.key
        store.result.items=[record]
        expect(store.rows.filter(row=>row.record?.id==='42')).toHaveLength(1)
        finish(media('43'));await pending
        expect(store.rows.filter(row=>row.record?.id==='42')).toHaveLength(1)
        expect(store.rows.find(row=>row.record?.id==='42')?.key).toBe(key)
    })
})
