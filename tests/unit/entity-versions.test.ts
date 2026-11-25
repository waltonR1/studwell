import {describe, expect, it} from 'vitest'
import {MAX_ENTITY_VERSION, MAX_WRITABLE_ENTITY_VERSION} from '../../shared/config/entity-versions'
import {userUpdateSchema, userResetSchema, userRolesSchema, userDeleteSchema, personalProfileSchema} from '../../shared/schemas/admin/users'
import {roleUpdateSchema, roleDeleteSchema, roleAuthorizationSchema} from '../../shared/schemas/admin/roles'
import {menuUpdateSchema, menuDeleteSchema, menuMoveSchema} from '../../shared/schemas/admin/menus'
import {dictionaryUpdateSchema, dictionaryItemCreateSchema, dictionaryItemUpdateSchema} from '../../shared/schemas/admin/dictionaries'
import {parameterUpdateSchema} from '../../shared/schemas/admin/parameters'
import {taskUpdateSchema, taskStatusSchema, taskRunSchema} from '../../shared/schemas/admin/tasks'

const menu = {iconKey: 'folder', name: 'Menu', parentId: null, sortOrder: 0, visible: true}
const contracts = [
    ['user update', userUpdateSchema, {displayName: 'User'}],
    ['user password', userResetSchema, {password: 'Stellar fixture 9036!'}],
    ['user roles', userRolesSchema, {roleIds: []}],
    ['user delete', userDeleteSchema, {}],
    ['profile', personalProfileSchema, {displayName: 'User', email: null}],
    ['role update', roleUpdateSchema, {name: 'Role', enabled: true}],
    ['role delete', roleDeleteSchema, {}],
    ['role authorization', roleAuthorizationSchema, {permissions: [], menuIds: []}],
    ['menu update', menuUpdateSchema, menu],
    ['menu delete', menuDeleteSchema, {}],
    ['menu move', menuMoveSchema, {neighborId: '1', neighborVersion: 1, direction: 'up'}],
    ['dictionary update', dictionaryUpdateSchema, {name: 'Dictionary', description: '', enabled: true}],
    ['dictionary item create', dictionaryItemCreateSchema, {code: 'fixture', name: 'Item', sortOrder: 0, enabled: true}],
    ['dictionary item update', dictionaryItemUpdateSchema, {dictionaryId: '1', name: 'Item', sortOrder: 0, enabled: true}],
    ['parameter update', parameterUpdateSchema, {value: false}],
    ['task update', taskUpdateSchema, {schedule: {mode: 'interval', minutes: 15}, retention: null}],
    ['task status', taskStatusSchema, {enabled: true}],
    ['task run', taskRunSchema, {confirmed: true}],
] as const

describe('实体乐观锁版本合同', () => {
    it.each(contracts)('%s 接受可写边界并拒绝溢出或隐式转换', (_name, schema, body) => {
        for (const version of [1, MAX_WRITABLE_ENTITY_VERSION]) expect(schema.safeParse({...body, version}).success).toBe(true)
        for (const version of [0, -1, 1.5, MAX_ENTITY_VERSION, MAX_ENTITY_VERSION + 1, Number.MAX_SAFE_INTEGER, NaN, Infinity, '1']) {
            expect(schema.safeParse({...body, version}).success).toBe(false)
        }
    })
    it('相邻菜单版本也遵循同一边界', () => {
        const input = {version: 1, neighborId: '2', direction: 'down'}
        expect(menuMoveSchema.safeParse({...input, neighborVersion: MAX_WRITABLE_ENTITY_VERSION}).success).toBe(true)
        expect(menuMoveSchema.safeParse({...input, neighborVersion: MAX_ENTITY_VERSION}).success).toBe(false)
    })
    it('联合授权必须同时提供菜单和权限，不接受旧单项提交', () => {
        expect(roleAuthorizationSchema.safeParse({version: 1, permissions: []}).success).toBe(false)
        expect(roleAuthorizationSchema.safeParse({version: 1, menuIds: []}).success).toBe(false)
    })
})
