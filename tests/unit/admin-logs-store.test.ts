import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import type {LogRecord} from '../../shared/types/admin/logs'
const io = vi.hoisted(() => ({listLogs: vi.fn(), getLog: vi.fn(), exportLogs: vi.fn()}))
vi.mock('~/api/admin/logs', () => ({createLogsApi: () => io}))
vi.mock('~/stores/admin/request', () => ({useAdminRequestStore: () => ({
    message: (e: unknown) => e instanceof Error ? e.message : '请求失败',
    operationMessage: (e: unknown) => e instanceof Error ? e.message : '操作失败',
})}))
import {useAdminLogsStore} from '../../app/stores/admin/logs'
import {useAdminSessionStore} from '../../app/stores/admin/session'
const record = (id: string) => ({id, requestId: `request-${id}`}) as LogRecord
const result = (id: string) => ({items: [record(id)], total: 1, page: 1, pageSize: 20, exportLimit: 100,
    range: {start: '', endExclusive: ''}})
function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>(done => { resolve = done })
    return {promise, resolve}
}
beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(io).forEach(mock => mock.mockReset())
    io.listLogs.mockResolvedValue(result('1'))
    const auth = useAdminSessionStore()
    auth.acceptSession({authenticated: true, mustChangePassword: false, csrfToken: 'csrf',
        user: {id: '1', username: 'root', displayName: 'Root', isRoot: true}}, auth.generation)
    auth.acceptPermissions({isRoot: true, permissions: [], version: '1'}, auth.generation)
})
describe('后台日志 store', () => {
    it('编号随查询、分页和导出保留，未提交文本不改变当前筛选', async () => {
        const store = useAdminLogsStore()
        const requestId = 'e248c9d2-d617-40ae-9585-99026ba1846f', logId = '2026103001000000001'
        await store.enter('audit', {requestId, logId})
        store.filters.requestId = 'f248c9d2-d617-40ae-9585-99026ba1846f'
        expect(store.buildQuery(2)).toMatchObject({requestId, logId, page: '2'})
        expect(store.buildQuery(1, true)?.requestId).toBe(store.filters.requestId)
        await store.exportCsv()
        expect(io.exportLogs).toHaveBeenCalledWith('audit', expect.objectContaining({requestId, logId}))
    })
    it('导出返回文件给页面，文件和 Blob 不进入业务状态', async () => {
        const store = useAdminLogsStore()
        await store.enter('audit', {period: '7d'})
        const file = {blob: new Blob(['id\n1']), filename: 'audit.csv', count: 1}
        io.exportLogs.mockResolvedValueOnce(file)
        expect(await store.exportCsv()).toBe(file)
        expect(store.feedback?.message).toContain('1 条')
        expect(store.$state).not.toHaveProperty('blob')
        expect(store.busy).toBe(false)
    })
    it('切换类别后不接受旧列表响应，并清理旧详情', async () => {
        const store = useAdminLogsStore(), old = deferred<ReturnType<typeof result>>()
        io.listLogs.mockReturnValueOnce(old.promise).mockResolvedValueOnce(result('audit'))
        const first = store.enter('login', {})
        await store.enter('audit', {})
        old.resolve(result('login')); await first
        expect(store.kind).toBe('audit')
        expect(store.data?.items[0]?.id).toBe('audit')
    })
    it('关闭详情及离开后旧响应不能恢复弹窗或列表', async () => {
        const store = useAdminLogsStore(), detail = deferred<LogRecord>()
        io.getLog.mockReturnValueOnce(detail.promise)
        const pending = store.openDetail(record('1'))
        store.closeDetail(); detail.resolve(record('1')); await pending
        expect(store.open).toBe(false); expect(store.selected).toBeNull()
        const response = deferred<ReturnType<typeof result>>()
        io.listLogs.mockReturnValueOnce(response.promise)
        const load = store.enter('login', {})
        store.leave(); response.resolve(result('late')); await load
        expect(store.data).toBeNull()
    })
    it('查询保留尚未提交的文本筛选边界，非法条件不导航', async () => {
        const store = useAdminLogsStore()
        await store.enter('login', {period: '7d', account: 'old_user'})
        store.filters.account = 'new_user'
        expect(store.buildQuery(1)?.account).toBe('old_user')
        expect(store.buildQuery(1, true)?.account).toBe('new_user')
        store.filters.result = 'not_a_result'
        expect(store.buildQuery(1, true)).toBeNull()
        expect(store.searchError).not.toBe('')
    })
    it('身份变化清空来源筛选、详情与快照，旧导出完成不恢复提示', async () => {
        const store = useAdminLogsStore(), response = deferred<number>()
        await store.enter('audit', {period: '7d'})
        io.exportLogs.mockReturnValueOnce(response.promise)
        const pending = store.exportCsv()
        useAdminSessionStore().resetIdentity()
        response.resolve(8); await pending
        expect(store.data).toBeNull(); expect(store.feedback).toBeNull()
        expect(store.busy).toBe(false)
    })
    it('同类别连续查看详情只接受最后一次请求', async () => {
        const store = useAdminLogsStore(), first = deferred<LogRecord>(), second = deferred<LogRecord>()
        io.getLog.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const a = store.openDetail(record('1')), b = store.openDetail(record('2'))
        second.resolve(record('2')); await b; first.resolve(record('1')); await a
        expect(store.selected?.id).toBe('2')
        expect(store.detailBusy).toBe(false)
    })
})
