import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useAdminRequestStore} from '../../app/stores/admin/request'
import {useAdminSessionStore} from '~/stores/admin/session'
import {useAdminNoticeStore} from '~/stores/admin/notice'

const authenticatedSession = {
    authenticated: true,
    mustChangePassword: false,
    user: {
        id: '2',
        username: 'operator',
        displayName: 'Operator',
        isRoot: false,
    },
    csrfToken: 'csrf',
}

beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAdminSessionStore()
    auth.acceptSession(authenticatedSession, auth.generation)
    auth.acceptPermissions({
        isRoot: false,
        permissions: ['system.roles.update'],
        version: 'p1',
    }, auth.generation)
})

describe('后台请求恢复上下文', () => {
    it('CSV 传输仅返回文件描述，不创建 DOM 或触发浏览器下载', async () => {
        const blob = new Blob(['id\n1'], {type: 'text/csv'})
        vi.stubGlobal('useRequestFetch', () => vi.fn())
        const raw = vi.fn().mockResolvedValue({
            _data: blob,
            headers: new Headers({'content-type': 'text/csv', 'content-disposition': 'attachment; filename="audit.csv"', 'x-export-row-count': '1'}),
        })
        vi.stubGlobal('$fetch', {raw})
        const file = await useAdminRequestStore().download('logs/audit/export', {period: '7d'})
        expect(file).toEqual({blob, filename: 'audit.csv', count: 1})
        expect(raw).toHaveBeenCalledWith('/api/admin/logs/audit/export', expect.objectContaining({
            method: 'POST', headers: {'X-CSRF-Token': 'csrf'}, responseType: 'blob',
        }))
        vi.unstubAllGlobals()
    })
    it('会话请求失败后刷新确认未登录，仍建立带目标地址的失效恢复状态', async () => {
        const auth = useAdminSessionStore()
        const oldGeneration = auth.generation
        const sessionExpiry = {
            data: {
                success: false,
                error: {
                    code: 'UNAUTHENTICATED',
                    message: '登录已失效',
                    fields: [],
                },
                requestId: 'req-session-expiry',
            },
        }
        const request = vi.fn().mockResolvedValueOnce({
            data: {
                authenticated: false,
                mustChangePassword: false,
                user: null,
                csrfToken: '',
            },
        })
        vi.stubGlobal('useRequestFetch', () => request)
        vi.stubGlobal('$fetch', vi.fn(async () => {
            throw sessionExpiry
        }))
        const api = useAdminRequestStore()

        await expect(api.mutate('roles', 'POST', {}, '/admin/roles?page=2')).rejects.toBe(sessionExpiry)

        expect(auth.generation).toBe(oldGeneration + 1)
        expect(auth.session?.authenticated).toBe(false)
        expect(auth.permissions).toBeNull()
        expect(auth.recovery).toEqual({
            kind: 'expired',
            returnTo: '/admin/roles?page=2',
        })
        expect(request).toHaveBeenCalledOnce()
        vi.unstubAllGlobals()
    })

    it('刷新期间已切换到另一有效账号时，不把旧请求误判为当前账号过期', async () => {
        const auth = useAdminSessionStore(), notice = useAdminNoticeStore()
        const oldGeneration = auth.generation
        const sessionExpiry = {
            data: {
                success: false,
                error: {
                    code: 'UNAUTHENTICATED',
                    message: '登录已失效',
                    fields: [],
                },
                requestId: 'req-identity-switched',
            },
        }
        const request = vi.fn().mockResolvedValueOnce({
            data: {
                authenticated: true,
                mustChangePassword: false,
                user: {
                    id: '3',
                    username: 'new_operator',
                    displayName: 'New Operator',
                    isRoot: false,
                },
                csrfToken: 'csrf_3',
            },
        })
        vi.stubGlobal('useRequestFetch', () => request)
        vi.stubGlobal('$fetch', vi.fn(async () => {
            throw sessionExpiry
        }))
        const api = useAdminRequestStore()

        await expect(api.mutate('roles', 'POST', {})).rejects.toBe(sessionExpiry)

        expect(auth.generation).toBe(oldGeneration + 1)
        expect(auth.session?.user?.id).toBe('3')
        expect(auth.recovery).toBeNull()
        expect(notice.notice).toBeNull()
        vi.unstubAllGlobals()
    })
})
