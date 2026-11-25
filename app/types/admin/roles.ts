// 角色菜单选择草稿与服务端基线的前端合同。
export interface MenuSelectionState {
    selected: string[]
    baseline: string[]
    initialized: boolean
}


export type AdminRoleQuery = Record<string, string | number | undefined>

export type AdminRoleListMutation = {fallbackPage?: number}
