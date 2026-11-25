// 真实任务 store 的异步与轮询边界；所有接口均为隔离替身。
import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia, disposePinia} from 'pinia'
import type {TaskRecord, TaskRunRecord} from '../../shared/types/admin/tasks'
const dependencies = vi.hoisted(() => ({tasks: {
  listTasks: vi.fn(), listTaskRuns: vi.fn(), getTaskRun: vi.fn(), previewSchedule: vi.fn(),
  updateTask: vi.fn(), changeTaskStatus: vi.fn(), runTask: vi.fn(), controlTaskRun: vi.fn(),
}}))
vi.mock('~/api/admin/tasks', () => ({createTasksApi: () => dependencies.tasks}))
vi.mock('~/stores/admin/request', () => ({useAdminRequestStore: () => ({
  message: (e: unknown) => e instanceof Error ? e.message : '请求失败',
  operationMessage: (e: unknown) => e instanceof Error ? e.message : '操作失败',
})}))
import {useAdminTasksStore} from '../../app/stores/admin/tasks'
import {useAdminSessionStore} from '../../app/stores/admin/session'
const task = (id = '1') => ({id, code: 'auth_cleanup', name: '会话清理', enabled: true, version: 1,
  schedule: {mode: 'daily', time: '03:00'}, retention: null, online: true,
  executionAllowed: true, activeRun: null}) as TaskRecord
const run = (id: string) => ({id, taskId: '1'}) as TaskRunRecord
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return {promise, resolve}
}
let pinia: ReturnType<typeof createPinia>
beforeEach(() => {
  pinia = createPinia(); setActivePinia(pinia)
  for (const mock of Object.values(dependencies.tasks)) mock.mockReset()
  dependencies.tasks.listTasks.mockResolvedValue([task()])
  dependencies.tasks.listTaskRuns.mockResolvedValue({items: [], total: 0, page: 1, pageSize: 20})
  const auth = useAdminSessionStore()
  auth.acceptSession({authenticated: true, mustChangePassword: false, csrfToken: 'csrf',
    user: {id: '1', username: 'root', displayName: 'Root', isRoot: true}}, auth.generation)
  auth.acceptPermissions({isRoot: true, permissions: [], version: '1'}, auth.generation)
})
afterEach(() => { disposePinia(pinia); vi.useRealTimers(); vi.unstubAllGlobals() })
describe('后台任务 store 生命周期', () => {
  it('基础计划无效时按共享 schema 阻止预览和保存', async () => {
    const store = useAdminTasksStore()
    store.edit(task()); store.draft.mode = 'interval'; store.draft.minutes = 4
    await store.preview(); await store.save()
    expect(dependencies.tasks.previewSchedule).not.toHaveBeenCalled()
    expect(dependencies.tasks.updateTask).not.toHaveBeenCalled()
    expect(store.dirty).toBe(true)
    expect(store.validationError).not.toBe('')
  })
  it('历史查询使用字符串分页合同，日期不完整时不发送请求', async () => {
    const store = useAdminTasksStore()
    await store.showHistory(task())
    expect(dependencies.tasks.listTaskRuns).toHaveBeenCalledWith('1', {page: '1', pageSize: '20'})
    dependencies.tasks.listTaskRuns.mockClear()
    store.filters.startDate = '2026-10-01'
    await store.filterHistory()
    expect(dependencies.tasks.listTaskRuns).not.toHaveBeenCalled()
    expect(store.historyBusy).toBe(false)
    expect(store.loadFailure).not.toBe('')
  })
  it('切换任务后旧历史响应不能覆盖当前任务', async () => {
    const first = deferred<unknown>(), second = deferred<unknown>(), store = useAdminTasksStore()
    dependencies.tasks.listTaskRuns.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const a = store.showHistory(task('1')), b = store.showHistory(task('2'))
    second.resolve({items: [run('20')], total: 1}); await b
    first.resolve({items: [run('10')], total: 1}); await a
    expect(store.historyTask?.id).toBe('2')
    expect(store.history?.items[0]?.id).toBe('20')
    expect(store.historyBusy).toBe(false)
  })
  it('关闭详情后迟到响应不能重新打开弹窗', async () => {
    const response = deferred<TaskRunRecord>(), store = useAdminTasksStore()
    dependencies.tasks.getTaskRun.mockReturnValueOnce(response.promise)
    const pending = store.showDetail(run('10'))
    store.closeDetail(); response.resolve(run('10')); await pending
    expect(store.detail).toBeNull()
  })
  it('连续查看详情时只接受最后一次选择的结果', async () => {
    const first = deferred<TaskRunRecord>(), second = deferred<TaskRunRecord>(), store = useAdminTasksStore()
    dependencies.tasks.getTaskRun.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const a = store.showDetail(run('10')), b = store.showDetail(run('20'))
    second.resolve(run('20')); await b; first.resolve(run('10')); await a
    expect(store.detail?.id).toBe('20')
  })
  it('预览期间草稿改变后丢弃旧计划时间', async () => {
    const response = deferred<{times: string[], text: string}>(), store = useAdminTasksStore()
    dependencies.tasks.previewSchedule.mockReturnValueOnce(response.promise)
    store.edit(task()); const pending = store.preview(); store.draft.time = '04:00'
    response.resolve({times: ['later'], text: ''}); await pending
    expect(store.previewTimes).toEqual([]); expect(store.dirty).toBe(true)
  })
  it('轮询唯一且不重入，离开后在途刷新不再请求历史或详情', async () => {
    vi.useFakeTimers(); vi.stubGlobal('window', {})
    const store = useAdminTasksStore()
    await store.enter(); await store.showHistory(task())
    const response = deferred<TaskRecord[]>()
    dependencies.tasks.listTasks.mockClear().mockReturnValueOnce(response.promise)
    dependencies.tasks.listTaskRuns.mockClear()
    store.startPolling(); store.startPolling()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(20000)
    expect(dependencies.tasks.listTasks).toHaveBeenCalledOnce()
    store.leave(); response.resolve([task()]); await vi.advanceTimersByTimeAsync(20000)
    expect(dependencies.tasks.listTaskRuns).not.toHaveBeenCalled()
    expect(dependencies.tasks.listTasks).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('配置草稿、确认或页面不可见暂停标记阻止轮询', async () => {
    const store = useAdminTasksStore(); await store.enter()
    dependencies.tasks.listTasks.mockClear()
    store.edit(task()); store.draft.time = '04:00'; await store.poll()
    expect(dependencies.tasks.listTasks).not.toHaveBeenCalled()
    store.closeEditor(); store.pollingPaused = true; await store.poll()
    expect(dependencies.tasks.listTasks).not.toHaveBeenCalled()
    store.pollingPaused = false; await store.poll()
    expect(dependencies.tasks.listTasks).toHaveBeenCalledOnce()
  })
  it('保存后刷新失败保留成功事实，草稿关闭且不重复提交', async () => {
    const store = useAdminTasksStore(); await store.enter(); store.edit(task()); store.draft.time = '04:00'
    dependencies.tasks.updateTask.mockResolvedValue(undefined)
    dependencies.tasks.listTasks.mockRejectedValueOnce(new Error('offline'))
    await store.save()
    expect(store.editing).toBeNull()
    expect(store.notification?.message).toContain('勿重复提交')
    expect(store.busy).toBe(false)
    expect(dependencies.tasks.updateTask).toHaveBeenCalledOnce()
  })
  it('身份切换后写入响应不能恢复旧状态或发起后续刷新', async () => {
    const store = useAdminTasksStore(); await store.enter()
    const response = deferred<void>(); dependencies.tasks.changeTaskStatus.mockReturnValueOnce(response.promise)
    dependencies.tasks.listTasks.mockClear()
    const pending = store.toggle(task()); useAdminSessionStore().resetIdentity()
    response.resolve(); await pending
    expect(store.data).toBeNull(); expect(store.notification).toBeNull()
    expect(dependencies.tasks.listTasks).not.toHaveBeenCalled()
  })
  it('任务配置字段校验留在弹窗，操作冲突使用 Toast 并保留草稿',async()=>{
    const store=useAdminTasksStore();await store.enter();store.edit(task());store.draft.time='04:00'
    dependencies.tasks.updateTask.mockRejectedValueOnce({data:{success:false,error:{code:'INVALID_INPUT',fields:[{path:'schedule',message:'执行计划不可用'}]},requestId:'test'}})
    await store.save()
    expect(store.validationError).toBe('执行计划不可用');expect(store.notification).toBeNull();expect(store.draft.time).toBe('04:00')
    dependencies.tasks.updateTask.mockRejectedValueOnce(new Error('version conflict'))
    await store.save()
    expect(store.validationError).toBe('');expect(store.notification).toEqual({message:'version conflict',status:'error'});expect(store.draft.time).toBe('04:00')
  })
  it('无执行权限或环境不允许时不发起真实任务动作', async () => {
    const store = useAdminTasksStore()
    await store.run({...task(), executionAllowed: false})
    useAdminSessionStore().resetIdentity()
    await store.run(task()); await store.control(run('10'), 'force')
    expect(dependencies.tasks.runTask).not.toHaveBeenCalled()
    expect(dependencies.tasks.controlTaskRun).not.toHaveBeenCalled()
  })
})
