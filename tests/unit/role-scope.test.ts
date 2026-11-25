import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {DatabaseExecutor} from '../../server/db/transaction'
const mocks = vi.hoisted(() => ({
    permissions: vi.fn(async () => [{roleId: 10n, code: 'system.roles.read'}, {roleId: 20n, code: 'system.roles.delete'}]),
    bindings: vi.fn(async () => [{roleId: 10n, menuId: 1n}, {roleId: 20n, menuId: 1n}]),
    assigned: vi.fn(async () => [1n]),
    all: vi.fn(async () => [{id: 1n, pageKey: 'roles'}]),
}))
vi.mock('../../server/repositories/roles', () => ({roleRepository: {permissionsForRoles: mocks.permissions}}))
vi.mock('../../server/repositories/menus', () => ({menuRepository: {bindingsForRoles: mocks.bindings, assigned: mocks.assigned, all: mocks.all}}))
import {roleGrantScope} from '../../server/services/access/role-scope'

beforeEach(() => vi.clearAllMocks())
describe('批量角色管理范围', () => {
    const db = {} as DatabaseExecutor
    const current = {isRoot: false, permissions: ['system.roles.read'], version: 'fixture'}
    it('保留权限和菜单双重上限，多个角色共用一次目录读取', async () => {
        const scope = await roleGrantScope(db, 1n, current, [10n, 20n, 10n])
        expect(scope.get(10n)).toBe(true)
        expect(scope.get(20n)).toBe(false)
        for (const mock of Object.values(mocks)) expect(mock).toHaveBeenCalledOnce()
        expect(mocks.permissions).toHaveBeenCalledWith(db, [10n, 20n])
    })
    it('Root 和空角色列表不查询授权关联', async () => {
        expect(await roleGrantScope(db, 1n, {...current, isRoot: true}, [10n, 20n])).toEqual(new Map([[10n, true], [20n, true]]))
        expect(await roleGrantScope(db, 1n, current, [])).toEqual(new Map())
        for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled()
    })
    it('缺少本人菜单授权时不能管理该角色', async () => {
        mocks.assigned.mockResolvedValueOnce([])
        expect((await roleGrantScope(db, 1n, current, [10n])).get(10n)).toBe(false)
    })
})
