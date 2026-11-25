// 检查外部值是否属于共享菜单图标白名单。
import {menuIconOptions} from '../../config/admin/menu-icons'
import type {MenuIconKey} from '../../types/admin/menus'

export function isMenuIconKey(value: unknown): value is MenuIconKey {
    return menuIconOptions.some(option => option.key === value)
}
