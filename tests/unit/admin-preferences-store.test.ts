import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import type {AdminSessionState} from '../../shared/types/admin/auth'

const dependencies = vi.hoisted(() => ({
    read: vi.fn(),
    message: vi.fn((error: unknown) => error instanceof Error ? error.message : '请求失败'),
}))

vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => ({
        read: dependencies.read,
        message: dependencies.message,
    }),
}))

import {useAdminPreferencesStore} from '../../app/stores/admin/preferences'
import {useAdminSessionStore} from '../../app/stores/admin/session'

const session = (id: string): AdminSessionState => ({
    authenticated: true,
    mustChangePassword: false,
    user: {
        id,
        username: `user_${id}`,
        displayName: `User ${id}`,
        isRoot: id === '1',
    },
    csrfToken: `csrf_${id}`,
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

beforeEach(() => {
    setActivePinia(createPinia())
    dependencies.read.mockReset()
    dependencies.message.mockClear()
    const auth = useAdminSessionStore()
    auth.acceptSession(session('2'), auth.generation)
})

describe('后台分页偏好 Pinia store', () => {
    it('有效响应更新本人缓存，版本相同时保留原值', async () => {
        const store = useAdminPreferencesStore()
        dependencies.read
            .mockResolvedValueOnce({changed: true, version: 'v1', pageSize: 50})
            .mockResolvedValueOnce({changed: false, version: 'v1'})

        await store.load('2')
        await store.load('2')

        expect(store.pageSize('2')).toBe(50)
        expect(dependencies.read).toHaveBeenLastCalledWith('auth/preferences', {version: 'v1'})
    })

    it('不同账号缓存隔离，身份重置后清空旧账号偏好', async () => {
        const store = useAdminPreferencesStore(), auth = useAdminSessionStore()
        dependencies.read
            .mockResolvedValueOnce({changed: true, version: 'root', pageSize: 50})
            .mockResolvedValueOnce({changed: true, version: 'user', pageSize: 10})

        await store.load('2')
        auth.resetIdentity()
        auth.acceptSession(session('3'), auth.generation)
        await nextTick()
        await store.load('3')

        expect(store.pageSize('2')).toBe(20)
        expect(store.pageSize('3')).toBe(10)
    })

    it('身份变化后旧请求不能写入新代次缓存', async () => {
        const store = useAdminPreferencesStore(), auth = useAdminSessionStore()
        const old = deferred<{changed: true, version: string, pageSize: number}>()
        const current = deferred<{changed: true, version: string, pageSize: number}>()
        dependencies.read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise)

        const oldLoad = store.load('2')
        auth.resetIdentity()
        auth.acceptSession(session('3'), auth.generation)
        await nextTick()
        const currentLoad = store.load('3')
        current.resolve({changed: true, version: 'new', pageSize: 10})
        await currentLoad
        old.resolve({changed: true, version: 'old', pageSize: 50})
        await oldLoad

        expect(store.pageSize('2')).toBe(20)
        expect(store.pageSize('3')).toBe(10)
    })

    it('当前会话读取失败明确报错，退出期间旧失败不阻塞页面', async () => {
        const store = useAdminPreferencesStore(), auth = useAdminSessionStore()
        dependencies.read.mockRejectedValueOnce(new Error('unavailable'))
        await expect(store.load('2')).rejects.toMatchObject({
            statusCode: 503,
            message: '后台分页配置读取失败，请刷新重试',
        })

        const late = deferred<never>()
        dependencies.read.mockReturnValueOnce(late.promise)
        const pending = store.load('2')
        auth.resetIdentity()
        await nextTick()
        late.reject(new Error('unauthenticated'))
        await expect(pending).resolves.toBeUndefined()
    })
})
