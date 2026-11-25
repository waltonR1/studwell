import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import type {EnvironmentData} from '../../shared/types/admin/environment'
const io = vi.hoisted(() => ({read: vi.fn(), permissions: vi.fn()}))
vi.mock('~/api/admin/environment', () => ({createEnvironmentApi: () => ({getEnvironment: io.read})}))
vi.mock('~/stores/admin/request', () => ({useAdminRequestStore: () => ({refreshPermissions: io.permissions, message: (e: unknown) => e instanceof Error ? e.message : '读取失败'})}))
import {useAdminEnvironmentStore} from '../../app/stores/admin/environment'
import {useAdminSessionStore} from '../../app/stores/admin/session'
const snapshot = (instanceId = 'one') => ({instanceId, sampledAt: '2026-10-28T00:00:00.000Z'}) as EnvironmentData
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => {resolve = done}); return {promise, resolve} }
beforeEach(() => {
    vi.useFakeTimers(); setActivePinia(createPinia())
    io.read.mockReset().mockResolvedValue(snapshot()); io.permissions.mockReset().mockResolvedValue(undefined)
    const session = useAdminSessionStore()
    session.acceptSession({authenticated: true, mustChangePassword: false, csrfToken: 'fixture', user: {id: '1', username: 'reader', displayName: 'reader', isRoot: false}}, session.generation)
    session.acceptPermissions({isRoot: false, permissions: ['system.environment.read'], version: '1'}, session.generation)
})
afterEach(() => { useAdminEnvironmentStore().leave(); vi.useRealTimers() })

describe('系统环境请求与轮询生命周期', () => {
    it('重复启动仅保留一个轮询；隐藏暂停，恢复后继续', async () => {
        const store = useAdminEnvironmentStore(); await store.enter(); store.startPolling(); store.startPolling()
        expect(vi.getTimerCount()).toBe(1)
        store.pollingPaused = true; await vi.advanceTimersByTimeAsync(30000)
        expect(io.read).toHaveBeenCalledTimes(1)
        store.pollingPaused = false; await vi.advanceTimersByTimeAsync(10000)
        expect(io.read).toHaveBeenCalledTimes(2)
        store.leave(); expect(vi.getTimerCount()).toBe(0)
    })
    it('SSR 水合后的已有快照仍能启动客户端轮询', async () => {
        const store = useAdminEnvironmentStore(); store.data = snapshot('hydrated'); store.startPolling()
        await vi.advanceTimersByTimeAsync(10000)
        expect(io.read).toHaveBeenCalledTimes(1)
        expect(store.data?.instanceId).toBe('one')
    })
    it('刷新失败保留上次快照并标明过期；成功后清除过期状态', async () => {
        const store = useAdminEnvironmentStore(); await store.enter()
        io.read.mockRejectedValueOnce(new Error('临时失败'))
        await expect(store.refresh()).rejects.toThrow('临时失败')
        expect(store.data?.instanceId).toBe('one'); expect(store.stale).toBe(true)
        await store.refresh(); expect(store.stale).toBe(false); expect(store.error).toBe('')
    })
    it('离开或身份切换后，迟到响应不能恢复旧数据或启动计时器', async () => {
        const store = useAdminEnvironmentStore(), response = deferred<EnvironmentData>()
        io.read.mockReturnValueOnce(response.promise)
        const request = store.enter(); await Promise.resolve(); await Promise.resolve()
        useAdminSessionStore().resetIdentity(); response.resolve(snapshot('late')); await request
        expect(store.data).toBeNull(); expect(store.pending).toBe(false); expect(vi.getTimerCount()).toBe(0)
    })
    it('权限撤销立即清空数据并停止轮询', async () => {
        const store = useAdminEnvironmentStore(); await store.enter(); store.startPolling()
        useAdminSessionStore().permissions = {isRoot: false, permissions: [], version: '2'}
        expect(store.data).toBeNull(); expect(vi.getTimerCount()).toBe(0)
        store.startPolling(); expect(vi.getTimerCount()).toBe(0)
    })
    it('旧轮询在离开重进后完成，不会创建第二个轮询', async () => {
        const store = useAdminEnvironmentStore(); await store.enter(); store.startPolling()
        const old = deferred<EnvironmentData>(); io.read.mockReturnValueOnce(old.promise)
        await vi.advanceTimersByTimeAsync(10000)
        store.leave(); await store.enter(); store.startPolling()
        old.resolve(snapshot('late')); await Promise.resolve(); await Promise.resolve()
        expect(store.data?.instanceId).toBe('one'); expect(vi.getTimerCount()).toBe(1)
    })
})
