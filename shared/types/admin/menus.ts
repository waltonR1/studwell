// 后台菜单管理、页面目录、导航与角色菜单授权的共享契约；页面路径由代码登记，导航返回只读投影。
import type {menuIconOptions} from '../../config/admin/menu-icons'

export type MenuIconKey = typeof menuIconOptions[number]['key']

export interface MenuRecord {
    hideDisabledReason?: string;
    deleteDisabledReason?: string;
    iconKey: MenuIconKey;
    id: string;
    parentId: string | null;
    code: string;
    pageKey: string | null;
    name: string;
    sortOrder: number;
    visible: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null
}

export interface MenuPage {
    key: string;
    name: string;
    path: string;
    permission: string;
    available: boolean;
    repeatable?: boolean;
    builtin?: boolean;
    operations?: readonly string[]
}

export interface NavigationItem {
    iconKey: MenuIconKey;
    id: string;
    parentId: string | null;
    code: string;
    name: string;
    path: string | null
}

export interface NavigationData {
    version: string;
    items: NavigationItem[]
}

export interface RoleMenuOption extends MenuRecord {
    grantable: boolean;
    permission?: string | null;
    operations?: readonly string[]
}

export interface RoleMenuData {
    version: number;
    menuIds: string[];
    items: RoleMenuOption[];
    pages?: readonly MenuPage[]
}

// 菜单页面目录接口的展示项，包含当前操作者是否可授予对应页面。
export interface MenuPageCatalogItem extends MenuPage {
    grantable: boolean
}
