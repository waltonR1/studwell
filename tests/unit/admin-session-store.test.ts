import {beforeEach, describe, expect, it} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useAdminSessionStore} from '../../app/stores/admin/session'
import {useAdminNoticeStore} from '../../app/stores/admin/notice'
import type {AdminSessionState} from '../../shared/types/admin/auth'

const session = (id: string, overrides: Partial<AdminSessionState> = {}): AdminSessionState => ({
    authenticated: true,
    mustChangePassword: false,
    user: {
        id,
        username: `user_${id}`,
        displayName: `User ${id}`,
        isRoot: id === '1',
    },
    csrfToken: `csrf_${id}`,
    ...overrides,
})

beforeEach(() => setActivePinia(createPinia()))

describe('后台身份与权限 Pinia store', () => {
    it('接受当前代次会话与权限，并拒绝过期响应', () => {
        const store = useAdminSessionStore()
        expect(store.acceptSession(session('1'), store.generation)).toBe(true)
        expect(store.currentUser?.id).toBe('1')
        expect(store.authenticated).toBe(true)

        const generation = store.generation
        expect(store.acceptPermissions({
            isRoot: true,
            permissions: ['system.users.read'],
            version: 'p1',
        }, generation)).toBe(true)
        expect(store.can('system.users.read')).toBe(true)
        expect(store.can('system.roles.read')).toBe(true)
        expect(store.acceptPermissions({
            isRoot: false,
            permissions: [],
            version: 'stale',
        }, generation - 1)).toBe(false)
        expect(store.permissions?.version).toBe('p1')
    })

    it('同账号刷新保留代次，同账号重新登录与不同账号切换都会推进代次', () => {
        const store = useAdminSessionStore()
        store.acceptSession(session('2'), store.generation)
        const initialGeneration = store.generation
        expect(store.acceptSession(session('2'), initialGeneration)).toBe(true)
        expect(store.generation).toBe(initialGeneration)

        store.resetIdentity()
        expect(store.generation).toBe(initialGeneration + 1)
        expect(store.session).toBeNull()
        expect(store.acceptSession(session('2'), store.generation)).toBe(true)
        expect(store.generation).toBe(initialGeneration + 1)

        expect(store.acceptSession(session('3'), store.generation)).toBe(true)
        expect(store.generation).toBe(initialGeneration + 2)
        expect(store.currentUser?.id).toBe('3')
    })

    it('已登录会话刷新为未登录时立即结束旧身份，下一账号获得新的代次', () => {
        const store = useAdminSessionStore(), notice = useAdminNoticeStore()
        store.acceptSession(session('2'), store.generation)
        store.acceptPermissions({
            isRoot: false,
            permissions: ['system.users.read'],
            version: 'p1',
        }, store.generation)
        notice.setNotice({kind: 'warning', message: '旧请求提示'})
        const oldGeneration = store.generation

        expect(store.acceptSession({
            authenticated: false,
            mustChangePassword: false,
            user: null,
            csrfToken: '',
        }, oldGeneration)).toBe(true)

        expect(store.generation).toBe(oldGeneration + 1)
        expect(store.transition).toBe('expired')
        expect(store.session?.authenticated).toBe(false)
        expect(store.permissions).toBeNull()
        expect(notice.notice).toBeNull()

        expect(store.acceptSession(session('3'), store.generation)).toBe(true)
        expect(store.generation).toBe(oldGeneration + 1)
        expect(store.currentUser?.id).toBe('3')
    })

    it('改密和会话失效使用受控恢复状态，身份切换会清理请求横幅', () => {
        const store = useAdminSessionStore(), notice = useAdminNoticeStore()
        store.acceptSession(session('2'), store.generation)
        notice.setNotice({kind: 'warning', message: '旧提示'})

        store.markPasswordChangeRequired('/admin/users')
        expect(notice.notice).toBeNull()
        expect(store.permissions).toBeNull()
        expect(store.recovery).toEqual({
            kind: 'password-change',
            returnTo: '/admin/users',
        })
        expect(store.session?.user?.id).toBe('2')

        store.markExpired('/admin/roles')
        expect(store.session).toBeNull()
        expect(store.permissions).toBeNull()
        expect(store.recovery).toEqual({kind: 'expired', returnTo: '/admin/roles'})
    })

    it('不同 Pinia 实例保持独立，避免 SSR 请求间身份泄漏', () => {
        const first = useAdminSessionStore()
        first.acceptSession(session('2'), first.generation)

        setActivePinia(createPinia())
        const second = useAdminSessionStore()
        expect(second.session).toBeNull()
        expect(second.generation).toBe(0)
    })
})
