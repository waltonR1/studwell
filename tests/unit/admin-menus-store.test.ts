import {beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {nextTick} from 'vue'
import type {MenuPageCatalogItem, MenuRecord} from '../../shared/types/admin/menus'

const dependencies = vi.hoisted(() => ({
    api: {

        message: vi.fn((error: unknown) => error instanceof Error ? error.message : '请求失败'),
        operationMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : '操作失败'),
        refreshPermissions: vi.fn(async () => {}),
    },
    menus: {
        listMenus: vi.fn(),
        getPageCatalog: vi.fn(),
        updateMenu: vi.fn(),
        moveMenu: vi.fn(),
        createMenu: vi.fn(),
        deleteMenu: vi.fn(),
    },
}))

vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => dependencies.api,
}))
vi.mock('~/api/admin/menus', () => ({
    createMenusApi: () => dependencies.menus,
}))

import {useAdminMenusStore} from '../../app/stores/admin/menus'
import {useAdminSessionStore} from '../../app/stores/admin/session'

const menu = (overrides: Partial<MenuRecord> = {}): MenuRecord => ({
    id: '20',
    code: 'users',
    name: '账号管理',
    pageKey: 'users',
    parentId: null,
    sortOrder: 100,
    visible: true,
    iconKey: 'users',
    version: 1,
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    createdBy: '1',
    updatedBy: '1',
    ...overrides,
})

const pages: MenuPageCatalogItem[] = [{
    key: 'users',
    name: '账号管理',
    path: '/admin/users',
    permission: 'system.users.read',
    available: true,
    grantable: true,
    builtin: true,
}]

beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAdminSessionStore()
    auth.acceptSession({
        authenticated: true,
        mustChangePassword: false,
        user: {
            id: '1',
            username: 'root',
            displayName: 'Root',
            isRoot: true,
        },
        csrfToken: 'csrf',
    }, auth.generation)
    auth.acceptPermissions({isRoot: true, permissions: [], version: 'p1'}, auth.generation)
    dependencies.api.refreshPermissions.mockClear()
    for (const value of Object.values(dependencies.menus))
        value.mockReset()
    dependencies.menus.listMenus.mockResolvedValue([menu()])
    dependencies.menus.getPageCatalog.mockResolvedValue(pages)
    dependencies.menus.updateMenu.mockResolvedValue({})
    dependencies.menus.moveMenu.mockResolvedValue({})
    dependencies.menus.createMenu.mockResolvedValue({})
    dependencies.menus.deleteMenu.mockResolvedValue({})
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

describe('菜单业务 Pinia store', () => {
    it('加载菜单树与页面目录，并建立编辑草稿', async () => {
        const store = useAdminMenusStore()
        await store.enter()
        expect(store.menus?.[0]?.code).toBe('users')
        expect(store.pages?.[0]?.key).toBe('users')

        store.edit(store.menus![0]!)
        expect(store.editor.open).toBe(true)
        expect(store.dirty).toBe(false)
        store.editor.form.name = '账号中心'
        expect(store.dirty).toBe(true)
    })

    it('编辑保存推进草稿基线并刷新权限', async () => {
        const store = useAdminMenusStore()
        await store.enter()
        store.edit(store.menus![0]!)
        store.editor.form.name = '账号中心'

        await store.saveEditor()

        expect(dependencies.menus.updateMenu).toHaveBeenCalledWith('20', expect.objectContaining({
            name: '账号中心',
            version: 1,
        }))
        expect(store.dirty).toBe(false)
        expect(store.editor.open).toBe(false)
        expect(dependencies.api.refreshPermissions).toHaveBeenCalledOnce()
        expect(store.feedback?.message).toBe('菜单已保存。')
    })

    it('显示切换和删除动作复用统一写入、刷新与反馈生命周期', async () => {
        const store = useAdminMenusStore()
        await store.enter()
        const row = store.menus![0]!

        await store.updateVisibility(row, false)
        expect(dependencies.menus.updateMenu).toHaveBeenCalledWith('20', expect.objectContaining({visible: false}))
        expect(store.feedback?.message).toBe('菜单已隐藏。')

        await store.remove(row)
        expect(dependencies.menus.deleteMenu).toHaveBeenCalledWith('20', 1)
        expect(store.feedback?.message).toBe('菜单已删除。')
    })

    it('写入成功而刷新失败保留持续警告，不误报成功反馈', async () => {
        const store = useAdminMenusStore()
        await store.enter()
        const row = store.menus![0]!
        dependencies.menus.listMenus.mockRejectedValueOnce(new Error('刷新离线'))

        await store.updateVisibility(row, false)

        expect(store.warning).toContain('菜单已隐藏')
        expect(store.feedback).toBeNull()
    })

    it('身份代次变化清空菜单、页面目录和编辑草稿', async () => {
        const store = useAdminMenusStore()
        await store.enter()
        store.edit(store.menus![0]!)
        store.editor.form.name = '未保存'
        useAdminSessionStore().resetIdentity()
        await nextTick()

        expect(store.menus).toBeNull()
        expect(store.pages).toBeNull()
        expect(store.editor.open).toBe(false)
        expect(store.editor.form.name).toBe('')
    })

    it('保存后的列表刷新期间切换身份，不向新身份写反馈或警告', async () => {
        const store = useAdminMenusStore()
        await store.enter()
        store.edit(store.menus![0]!)
        store.editor.form.name = '账号中心'
        const refreshStarted = deferred<void>()
        const refreshResponse = deferred<MenuRecord[]>()
        dependencies.menus.listMenus.mockImplementationOnce(() => {
            refreshStarted.resolve(undefined)
            return refreshResponse.promise
        })

        const pending = store.saveEditor()
        await refreshStarted.promise
        useAdminSessionStore().resetIdentity()
        await nextTick()
        refreshResponse.resolve([menu({name: '账号中心'})])
        const result = await pending

        expect(result).toMatchObject({submitted: true, succeeded: false})
        expect(store.feedback).toBeNull()
        expect(store.warning).toBe('')
    })
})
