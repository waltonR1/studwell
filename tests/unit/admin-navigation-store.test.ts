import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useAdminNavigationStore} from '../../app/stores/admin/navigation'
import type {NavigationData} from '../../shared/types/admin/menus'

const navigation = (version: string, name = '账号管理'): NavigationData => ({
    version,
    items: [{
        id: version,
        parentId: null,
        code: version,
        name,
        path: '/admin/users',
        iconKey: 'users',
    }],
})

const context = (generation = 0, ownerId = '2', active = true) => ({
    generation,
    ownerId,
    active,
})

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason: unknown) => void
    const promise = new Promise<T>((done, fail) => {
        resolve = done
        reject = fail
    })
    return {promise, resolve, reject}
}

beforeEach(() => setActivePinia(createPinia()))

describe('后台导航 Pinia store', () => {
    it('同一身份只加载一次，手动刷新会重新请求', async () => {
        const store = useAdminNavigationStore()
        const request = vi.fn(async () => navigation('v1'))

        await store.enter(request, context())
        await store.enter(request, context())
        expect(request).toHaveBeenCalledOnce()
        expect(store.data?.version).toBe('v1')

        await store.refresh(request, context())
        expect(request).toHaveBeenCalledTimes(2)
    })

    it('账号或身份代次变化清空旧导航，旧响应不能覆盖新账号', async () => {
        const store = useAdminNavigationStore()
        const old = deferred<NavigationData>(), current = deferred<NavigationData>()
        const oldRequest = vi.fn(() => old.promise)
        const currentRequest = vi.fn(() => current.promise)

        const oldLoad = store.enter(oldRequest, context(0, '2'))
        const currentLoad = store.enter(currentRequest, context(1, '3'))
        current.resolve(navigation('new', '新账号导航'))
        await currentLoad
        old.resolve(navigation('old', '旧账号导航'))
        await oldLoad

        expect(store.identityKey).toBe('1:3')
        expect(store.data?.version).toBe('new')
        expect(store.data?.items[0]?.name).toBe('新账号导航')
    })

    it('业务写入标记失效后重新加载，失败只保存受控错误且不保留旧数据', async () => {
        const store = useAdminNavigationStore()
        await store.enter(async () => navigation('v1'), context())
        store.invalidate()
        expect(store.stale).toBe(true)
        expect(store.revision).toBe(1)

        const failed = vi.fn(async () => {
            throw new Error('导航离线')
        })
        await store.enter(failed, context())
        expect(store.data).toBeNull()
        expect(store.error).toContain('连接失败')
    })

    it('离开或身份重置会使在途响应失效，迟到响应不能恢复导航', async () => {
        const store = useAdminNavigationStore()
        const late = deferred<NavigationData>()
        const load = store.enter(() => late.promise, context())
        store.leave()
        late.resolve(navigation('late'))
        await load

        expect(store.data).toBeNull()
        expect(store.stale).toBe(true)
        expect(store.identityKey).toBe('')
    })
})
