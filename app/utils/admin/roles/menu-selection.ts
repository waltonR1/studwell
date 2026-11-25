// 同步角色菜单选择基线：首次加载初始化，刷新时保留尚未提交的选择。
import type {MenuSelectionState} from '~/types/admin/roles'

function same(items: string[], other: string[]) {
    return items.length === other.length && items.every((item, index) => item === other[index])
}

export function reconcileMenuSelection(current: MenuSelectionState, incoming: string[]): MenuSelectionState {
    const initialized = true
    if (!current.initialized) return {selected: [...incoming], baseline: [...incoming], initialized}
    if (!same([...current.selected].sort(), [...current.baseline].sort())) return current
    return {selected: [...incoming], baseline: [...incoming], initialized}
}
