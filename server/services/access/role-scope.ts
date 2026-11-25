// 计算操作者可授予的角色范围，不处理 HTTP 响应。
import type {DatabaseExecutor} from '../../db/transaction'
import {roleRepository} from '../../repositories/roles'
import {menuRepository} from '../../repositories/menus'
import {permissionCatalog} from '../../config/permissions'
import {page} from '../../policies/menu-model'
import type {getPermissionSnapshot} from './permissions'

// 一次读取请求范围内的角色权限和菜单，避免逐角色重复查询整棵菜单树。
export async function roleGrantScope(db: DatabaseExecutor, actor: bigint, current: Awaited<ReturnType<typeof getPermissionSnapshot>>, input: bigint[]) {
    const ids = [...new Set(input)], result = new Map(ids.map(id => [id, true]))
    if (current.isRoot || !ids.length) return result
    const permissions = await roleRepository.permissionsForRoles(db, ids)
    const bindings = await menuRepository.bindingsForRoles(db, ids)
    const assigned = new Set((await menuRepository.assigned(db, actor)).map(String))
    const rows = new Map((await menuRepository.all(db)).map(row => [row.id, row]))
    const active = new Set(permissionCatalog.filter(item => item.available).map(item => item.code))
    for (const permission of permissions) {
        if (!active.has(permission.code) || !current.permissions.includes(permission.code)) result.set(permission.roleId, false)
    }
    for (const binding of bindings) {
        const definition = page(rows.get(binding.menuId)?.pageKey ?? null)
        if (!assigned.has(String(binding.menuId)) || !definition || !current.permissions.includes(definition.permission)) result.set(binding.roleId, false)
    }
    return result
}
