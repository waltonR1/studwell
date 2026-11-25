// 角色权限的批量选择计算；不修改传入数组，不执行授权请求。
import type {RolePermission} from '#shared/types/admin/roles.ts'

// 批量操作仅使用当前分组筛选结果中的有效可授予项；历史/越界项保持原值。
export function permissionBatchState(items: RolePermission[], selected: string[]) {
    const eligible = items.filter(item => item.available && item.grantable).map(item => item.code)
    const chosen = new Set(selected), count = eligible.filter(code => chosen.has(code)).length
    return {
        eligible,
        count,
        checked: eligible.length > 0 && count === eligible.length,
        indeterminate: count > 0 && count < eligible.length
    }
}

export function togglePermissionBatch(items: RolePermission[], selected: string[], checked: boolean) {
    const {eligible} = permissionBatchState(items, selected), result = new Set(selected)
    for (const code of eligible) {
        if (checked) result.add(code); else result.delete(code)
    }
    return [...result]
}
