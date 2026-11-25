import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import type {DashboardData} from '../../shared/types/admin/dashboard'
import type {NavigationData} from '../../shared/types/admin/menus'
const io = vi.hoisted(() => ({dashboard: vi.fn(), permissions: vi.fn()}))
vi.mock('~/api/admin/dashboard', () => ({createDashboardApi: () => ({getDashboard: io.dashboard})}))
vi.mock('~/stores/admin/request', () => ({useAdminRequestStore: () => ({
    refreshPermissions: io.permissions,
    message: (e: unknown) => e instanceof Error ? e.message : '请求失败',
})}))
import {useAdminDashboardStore} from '../../app/stores/admin/dashboard'
import {useAdminNavigationStore} from '../../app/stores/admin/navigation'
import {useAdminSessionStore} from '../../app/stores/admin/session'
beforeEach(() => {
    setActivePinia(createPinia())
    io.dashboard.mockReset().mockResolvedValue({stats: {users: 2}, updatedAt: '', range: {start: '', endExclusive: ''}})
    io.permissions.mockReset().mockResolvedValue(undefined)
    const auth = useAdminSessionStore()
    auth.acceptSession({authenticated: true, mustChangePassword: false, csrfToken: 'csrf',
        user: {id: '1', username: 'root', displayName: 'Root', isRoot: true}}, auth.generation)
    auth.acceptPermissions({isRoot: true, permissions: [], version: '1'}, auth.generation)
})
describe('首页统计 store', () => {
    it('导航入口直接跟随导航 store，统计不持有第二份导航', async () => {
        const store = useAdminDashboardStore(), navigation = useAdminNavigationStore()
        navigation.data = {version: '1', items: [{id: '1', name: '账号', path: '/admin/users', iconKey: 'users'}]} as NavigationData
        await store.load()
        expect(store.overview?.stats.users).toBe(2)
        expect(store.links[0]?.name).toBe('账号')
        navigation.data = {version: '2', items: []}
        expect(store.links).toEqual([])
        expect(store.$state).not.toHaveProperty('navigation')
    })
    it('身份切换后迟到统计不能恢复旧数据', async () => {
        let resolve!: (value: DashboardData) => void
        io.dashboard.mockReturnValueOnce(new Promise<DashboardData>(done => { resolve = done }))
        const store = useAdminDashboardStore(), pending = store.load()
        await Promise.resolve()
        useAdminSessionStore().resetIdentity()
        resolve({stats: {users: 99}, updatedAt: '', range: {start: '', endExclusive: ''}})
        await pending
        expect(store.overview).toBeNull()
        expect(store.pending).toBe(false)
    })
    it('无统计权限时保留导航展示但不请求统计', async () => {
        const auth = useAdminSessionStore()
        auth.permissions = {isRoot: false, permissions: [], version: '2'}
        const store = useAdminDashboardStore()
        await store.load()
        expect(io.dashboard).not.toHaveBeenCalled()
        expect(store.overview).toBeNull()
    })
})
