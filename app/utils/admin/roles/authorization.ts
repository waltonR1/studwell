// 计算页面菜单所需权限及取消菜单时可移除的权限，供角色授权草稿使用。
import type {RoleMenuOption} from '#shared/types/admin/menus.ts'
import type {RolePermission} from '#shared/types/admin/roles.ts'

export function requiredMenuPermissions(items: RoleMenuOption[], menuIds: string[]) {
    return [...new Set(items.filter(item => menuIds.includes(item.id) && item.permission).map(item => item.permission!))]
}

// 同一模板的另一菜单仍保留时，相关权限不能随本入口取消而清理。
export function removableMenuPermissions(item: RoleMenuOption, items: RoleMenuOption[], remaining: string[], catalog: RolePermission[], selected: string[]) {
    const retained = new Set(items.filter(row => remaining.includes(row.id)).flatMap(row => [...(row.operations ?? []), ...(row.permission ? [row.permission] : [])]))
    return (item.operations ?? []).filter(code => selected.includes(code) && !retained.has(code) && catalog.some(permission => permission.code === code && permission.available && permission.grantable))
}
