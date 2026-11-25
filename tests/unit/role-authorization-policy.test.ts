import {describe, expect, it} from 'vitest'
import {validateRoleAuthorization} from '../../server/policies/role-authorization'

const rows = [{id: 1n, pageKey: 'roles'}, {id: 2n, pageKey: 'menus'}, {id: 3n, pageKey: null}]
describe('角色最终授权组合', () => {
    it('允许空授权和内置首页权限', () => {
        expect(() => validateRoleAuthorization([], [], rows)).not.toThrow()
        expect(() => validateRoleAuthorization(['system.dashboard.read'], [], rows)).not.toThrow()
    })
    it('页面菜单要求查看权限，操作权限要求对应菜单', () => {
        expect(() => validateRoleAuthorization(['system.roles.read', 'system.roles.delete'], ['1'], rows)).not.toThrow()
        expect(() => validateRoleAuthorization([], ['1'], rows)).toThrow()
        expect(() => validateRoleAuthorization(['system.roles.read'], [], rows)).toThrow()
        expect(() => validateRoleAuthorization(['system.roles.delete'], ['1'], rows)).toThrow()
    })
    it('拒绝目录、未知菜单和未绑定页面的操作', () => {
        expect(() => validateRoleAuthorization([], ['3'], rows)).toThrow()
        expect(() => validateRoleAuthorization([], ['404'], rows)).toThrow()
        expect(() => validateRoleAuthorization(['system.roles.read', 'system.menus.delete'], ['1'], rows)).toThrow()
    })
})
