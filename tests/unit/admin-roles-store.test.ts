import {beforeEach, describe, expect, it, vi} from 'vitest'
import {nextTick} from 'vue'
import {createPinia, setActivePinia} from 'pinia'
import type {RoleDetail, RoleListRecord} from '../../shared/types/admin/roles'
import type {RoleMenuData} from '../../shared/types/admin/menus'

const dependencies = vi.hoisted(() => ({
    api: {

        message: vi.fn((error: unknown) => error instanceof Error ? error.message : '请求失败'),
        operationMessage: vi.fn((error: unknown) => error instanceof Error ? error.message : '操作失败'),
        refreshPermissions: vi.fn(async () => {}),
    },
    roles: {
        listRoles: vi.fn(),
        getRole: vi.fn(),
        getPermissionCatalog: vi.fn(),
        getRoleMenus: vi.fn(),
        createRole: vi.fn(),
        updateRole: vi.fn(),
        deleteRole: vi.fn(),
        assignAuthorization: vi.fn(),
    },
}))

vi.mock('~/stores/admin/request', () => ({
    useAdminRequestStore: () => dependencies.api,
}))
vi.mock('~/api/admin/roles', () => ({
    createRolesApi: () => dependencies.roles,
}))

import {useAdminRolesStore} from '../../app/stores/admin/roles'
import {useAdminSessionStore} from '../../app/stores/admin/session'

const role = (overrides: Partial<RoleDetail> = {}): RoleDetail => ({
    id: '10',
    code: 'editor',
    name: 'Editor',
    enabled: true,
    version: 1,
    createdAt: '2026-10-23T00:00:00Z',
    updatedAt: '2026-10-23T00:00:00Z',
    createdBy: '1',
    updatedBy: '1',
    permissions: ['system.users.read'],
    ...overrides,
})

const listRole = (overrides: Partial<RoleListRecord> = {}): RoleListRecord => ({
    ...role(),
    userCount: 1,
    ...overrides,
})

const roleMenus = (menuIds: string[] = []): RoleMenuData => ({
    version: 1,
    menuIds,
    items: [{
        id: '20',
        parentId: null,
        code: 'users',
        pageKey: 'users',
        name: '账号管理',
        sortOrder: 100,
        visible: true,
        version: 1,
        createdAt: '2026-10-23T00:00:00Z',
        updatedAt: '2026-10-23T00:00:00Z',
        createdBy: '1',
        updatedBy: '1',
        iconKey: 'users',
        grantable: true,
        permission: 'system.users.read',
        operations: ['system.users.read', 'system.users.update'],
    }],
})

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
    for (const value of Object.values(dependencies.roles))
        value.mockReset()
    dependencies.roles.listRoles.mockResolvedValue({
        items: [listRole()],
        total: 1,
        page: 1,
        pageSize: 20,
    })
    dependencies.roles.getRole.mockResolvedValue(role())
    dependencies.roles.getPermissionCatalog.mockResolvedValue([
        {code: 'system.users.read', name: '查看账号', available: true, grantable: true},
        {code: 'system.users.update', name: '编辑账号', available: true, grantable: true},
    ])
    dependencies.roles.getRoleMenus.mockResolvedValue(roleMenus())
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

describe('角色业务 Pinia store', () => {
    it('权限撤销后角色资料和授权均按身份 store 禁止提交', async () => {
        const store = useAdminRolesStore(), auth = useAdminSessionStore()
        await store.enterEditor('10')
        store.editor.form.name = 'Draft'
        auth.acceptPermissions({isRoot: false, permissions: ['system.roles.read'], version: 'revoked'}, auth.generation)
        expect(store.editable).toBe(false)
        expect(await store.saveMetadata()).toMatchObject({submitted: false})
        expect(await store.saveAuthorization()).toMatchObject({submitted: false})
        expect(dependencies.roles.updateRole).not.toHaveBeenCalled()
        expect(dependencies.roles.assignAuthorization).not.toHaveBeenCalled()
    })
    it('加载列表并创建角色，创建成功后清空非敏感草稿', async () => {
        const store = useAdminRolesStore()
        await store.enterList({})
        expect(store.list.data?.items[0]?.id).toBe('10')

        Object.assign(store.list.form, {
            code: 'auditor',
            name: 'Auditor',
            enabled: true,
        })
        dependencies.roles.createRole.mockResolvedValue({id: '11'})
        expect(await store.createRole()).toEqual({id: '11'})
        expect(store.list.form).toEqual({code: '', name: '', enabled: true})
        expect(store.list.createdRole).toEqual({id: '11'})
    })

    it('详情加载分别建立资料、权限和菜单基线', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')

        expect(store.editor.form.name).toBe('Editor')
        expect(store.editor.selected).toEqual(['system.users.read'])
        expect(store.editor.menuBaseline).toEqual([])
        expect(store.metadataDirty).toBe(false)
        expect(store.permissionsDirty).toBe(false)
        expect(store.menuDirty).toBe(false)
    })

    it('资料保存只推进资料基线，不覆盖菜单和权限草稿', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        store.editor.form.name = 'Renamed'
        store.editor.selected = ['system.users.read', 'system.users.update']
        store.editor.menuIds = ['20']
        dependencies.roles.updateRole.mockResolvedValue({version: 2})

        await store.saveMetadata()

        expect(store.editor.role?.name).toBe('Renamed')
        expect(store.editor.role?.version).toBe(2)
        expect(store.permissionsDirty).toBe(true)
        expect(store.menuDirty).toBe(true)
    })

    it('页面菜单变化可带入或成组撤销必要权限，并区分确认后提交', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        const item = store.authorizationOptions[0]!

        const add = store.prepareMenuToggle(item, true)
        expect(add).toEqual({allowed: true, needsConfirmation: false})
        expect(store.editor.menuIds).toEqual(['20'])
        expect(store.editor.selected).toEqual(['system.users.read'])

        store.editor.selected.push('system.users.update')
        const remove = store.prepareMenuToggle(item, false)
        expect(remove).toMatchObject({allowed: false, needsConfirmation: true})
        store.commitMenuRemoval()
        expect(store.editor.menuIds).toEqual([])
        expect(store.editor.selected).toEqual([])
    })

    it('联合授权保存推进共享角色版本和菜单基线', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        store.prepareMenuToggle(store.authorizationOptions[0]!, true)
        store.editor.selected.push('system.users.update')
        dependencies.roles.assignAuthorization.mockResolvedValue({version: 2})
        dependencies.roles.getRoleMenus.mockResolvedValue(roleMenus(['20']))

        await store.saveAuthorization()

        expect(dependencies.roles.assignAuthorization).toHaveBeenCalledWith('10', {
            version: 1,
            menuIds: ['20'],
            permissions: ['system.users.read', 'system.users.update'],
        })
        expect(store.editor.role?.version).toBe(2)
        expect(store.editor.menuBaseline).toEqual(['20'])
        expect(store.menuDirty).toBe(false)
        expect(store.permissionsDirty).toBe(false)
    })

    it('同一角色连续刷新授权目录后仍更新基线并结束加载', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        dependencies.roles.getRoleMenus.mockResolvedValueOnce(roleMenus(['20']))
        await store.refreshAuthorization()
        expect(store.editor.menuBaseline).toEqual(['20'])
        expect(store.editor.menusPending).toBe(false)

        dependencies.roles.getRoleMenus.mockResolvedValueOnce(roleMenus([]))
        await store.refreshAuthorization()
        expect(store.editor.menuIds).toEqual([])
        expect(store.editor.menuBaseline).toEqual([])
        expect(store.editor.menusPending).toBe(false)
        expect(store.authorizationReady).toBe(true)
    })

    it('同一角色并发刷新授权时旧响应不能覆盖新目录或提前结束加载', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        const old = deferred<RoleMenuData>(), current = deferred<RoleMenuData>()
        dependencies.roles.getRoleMenus
            .mockReturnValueOnce(old.promise)
            .mockReturnValueOnce(current.promise)
        const oldRefresh = store.refreshAuthorization()
        const currentRefresh = store.refreshAuthorization()

        old.resolve(roleMenus(['20']))
        await oldRefresh
        expect(store.editor.menuBaseline).toEqual([])
        expect(store.editor.menusPending).toBe(true)

        current.resolve(roleMenus(['20']))
        await currentRefresh
        expect(store.editor.menuBaseline).toEqual(['20'])
        expect(store.editor.menusPending).toBe(false)
    })

    it('身份代次变化清空列表、详情和联合授权状态', async () => {
        const store = useAdminRolesStore()
        await store.enterList({})
        await store.enterEditor('10')
        store.prepareMenuToggle(store.authorizationOptions[0]!, true)
        useAdminSessionStore().resetIdentity()
        await nextTick()

        expect(store.list.data).toBeNull()
        expect(store.editor.role).toBeNull()
        expect(store.editor.menuIds).toEqual([])
        expect(store.editor.selected).toEqual([])
    })

    it('目录与授权刷新迟到时不能覆盖另一个角色的编辑器', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        const oldCatalog = deferred<Array<{code: string, name: string, available: boolean, grantable: boolean}>>()
        const oldMenus = deferred<RoleMenuData>()
        dependencies.roles.getPermissionCatalog.mockReturnValueOnce(oldCatalog.promise)
        dependencies.roles.getRoleMenus.mockReturnValueOnce(oldMenus.promise)
        const catalogRefresh = store.refreshCatalog()
        const menuRefresh = store.refreshAuthorization()

        dependencies.roles.getRole.mockResolvedValueOnce(role({
            id: '11',
            code: 'reviewer',
            name: 'Reviewer',
            permissions: [],
        }))
        dependencies.roles.getPermissionCatalog.mockResolvedValueOnce([
            {code: 'system.roles.read', name: '查看角色', available: true, grantable: true},
        ])
        dependencies.roles.getRoleMenus.mockResolvedValueOnce(roleMenus(['21']))
        await store.enterEditor('11')

        oldCatalog.resolve([{code: 'stale.permission', name: '旧权限', available: true, grantable: true}])
        oldMenus.resolve(roleMenus(['20']))
        await Promise.all([catalogRefresh, menuRefresh])

        expect(store.editor.id).toBe('11')
        expect(store.editor.catalog?.map(item => item.code)).toEqual(['system.roles.read'])
        expect(store.editor.menuIds).toEqual(['21'])
        expect(store.editor.menuBaseline).toEqual(['21'])
    })

    it('角色保存后的权限刷新期间切换身份，不向已重置状态写反馈', async () => {
        const store = useAdminRolesStore()
        await store.enterEditor('10')
        store.editor.form.name = 'Renamed'
        dependencies.roles.updateRole.mockResolvedValue({version: 2})
        const permissionsStarted = deferred<void>()
        const permissionsResponse = deferred<void>()
        dependencies.api.refreshPermissions.mockImplementationOnce(() => {
            permissionsStarted.resolve(undefined)
            return permissionsResponse.promise
        })

        const pending = store.saveMetadata()
        await permissionsStarted.promise
        useAdminSessionStore().resetIdentity()
        await nextTick()
        permissionsResponse.resolve(undefined)
        const result = await pending

        expect(result).toMatchObject({submitted: true, succeeded: false})
        expect(store.editor.feedback).toBeNull()
        expect(store.editor.warning).toBe('')
    })
})
