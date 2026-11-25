import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useAdminInquiriesStore} from '../../app/stores/admin/inquiries'

const {api, operationMessage} = vi.hoisted(() => ({
    api: {list: vi.fn(), get: vi.fn(), update: vi.fn()},
    operationMessage: vi.fn(),
}))
vi.mock('~/api/admin/inquiries', () => ({createInquiriesApi: () => api}))
vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => ({message: () => '连接失败', operationMessage}),
}))

describe('客户咨询操作反馈', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        setActivePinia(createPinia())
        api.get.mockResolvedValue({
            inquiry: {id:'10', version:1, status:'pending', assigneeId:null}, history:[], mail:[], mailKinds:[], assignees:[],
        })
        api.update.mockResolvedValue({
            inquiry: {id:'10', version:2, status:'pending', assigneeId:null}, history:[], mail:[], mailKinds:[],
        })
        api.list.mockResolvedValue({items:[], total:0, page:1, pageSize:20, categories:[], assignees:[]})
    })

    async function withNote() {
        const store = useAdminInquiriesStore()
        await store.enter({page:1, pageSize:20})
        await store.open('10')
        store.note = '客户希望先确认产品规格'
        return store
    }

    it('跟进保存并刷新列表后才提示成功', async () => {
        const store = await withNote()
        const notification = await store.saveNote()
        expect(store.note).toBe('')
        expect(notification).toEqual({message:'跟进已记录。', status:'success'})
    })

    it('保存成功但列表刷新失败时保留警告，重试只读列表', async () => {
        const store = await withNote()
        api.list.mockRejectedValueOnce(new Error('network'))
        const notification = await store.saveNote()
        expect(store.note).toBe('')
        expect(notification).toBeNull()
        expect(store.warning).toContain('已保存')
        await store.refreshList()
        expect(store.warning).toBe('')
        expect(api.update).toHaveBeenCalledTimes(1)
    })

    it('表单失败保留输入并就地反馈，已由全局接管的错误不重复提示', async () => {
        const store = await withNote()
        api.update.mockRejectedValue(new Error('rejected'))
        operationMessage.mockReturnValueOnce('操作未完成').mockReturnValueOnce('')
        const first = await store.saveNote()
        expect(store.note).toBe('客户希望先确认产品规格')
        expect(store.submitErrors.note).toBe('操作未完成')
        expect(first).toBeNull()
        const second = await store.saveNote()
        expect(store.submitErrors.note).toBe('')
        expect(second).toBeNull()
    })
})
