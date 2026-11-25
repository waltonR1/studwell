// 菜单请求适配；树、表单与提示归业务 store。
import type {MenuCreateInput, MenuUpdateInput, MenuMoveInput, MenuDeleteInput} from '~/types/admin/api-inputs'
import type {AdminApiClient} from '~/types/admin/api'
import type {MenuRecord, MenuPageCatalogItem, NavigationData} from '#shared/types/admin/menus'

export function createMenusApi(api: AdminApiClient) {
    return {
        listMenus: () => api.read<MenuRecord[]>('menus'),
        getPageCatalog: () => api.read<MenuPageCatalogItem[]>('menus/catalog'),
        getNavigation: () => api.read<NavigationData>('auth/navigation'),
        createMenu: (body: MenuCreateInput) => api.mutate('menus', 'POST', body),
        updateMenu: (id: string, body: MenuUpdateInput) => api.mutate(`menus/${id}`, 'PUT', body),
        moveMenu: (id: string, body: MenuMoveInput) => api.mutate(`menus/${id}/move`, 'PUT', body),
        deleteMenu: (id: string, version: MenuDeleteInput['version']) => api.mutate(`menus/${id}`, 'DELETE', {version} satisfies MenuDeleteInput),
    }
}
