// 校验菜单与权限的联合授权约束，不写入角色授权。
import {ApiError} from '../core/errors'
import {menuPageCatalog} from '../config/menus'
import {permissionCatalog} from '../config/permissions'

type MenuBinding = {id: bigint; pageKey: string | null}
export function validateRoleAuthorization(permissions: readonly string[], menuIds: readonly string[], rows: readonly MenuBinding[]) {
    const byId = new Map(rows.map(row => [String(row.id), row]))
    const bound = new Set(menuPageCatalog.filter(item => item.builtin).flatMap(item => item.operations ?? []))
    for (const id of menuIds) {
        const row = byId.get(id)
        if (!row) throw new ApiError('INVALID_INPUT')
        const definition = menuPageCatalog.find(item => item.key === row.pageKey && item.available && permissionCatalog.some(p => p.code === item.permission && p.available))
        // Only page menus can be assigned; directories are derived in navigation.
        if (!definition) throw new ApiError('INVALID_INPUT')
        if (!permissions.includes(definition.permission)) throw new ApiError('INVALID_INPUT')
        for (const code of definition.operations ?? []) bound.add(code)
    }
    if (permissions.some(code => !bound.has(code))) throw new ApiError('INVALID_INPUT')
}
