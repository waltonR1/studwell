// 角色资料和联合授权接口，不改变菜单与操作权限的提交协议。
import type {RoleCreateInput, RoleUpdateInput, RoleAuthorizationInput, RoleDeleteInput} from '~/types/admin/api-inputs'
import type {AdminApiClient} from '~/types/admin/api'
import type {RoleDetail, RoleListRecord, RolePermission} from '#shared/types/admin/roles'
import type {RoleMenuData} from '#shared/types/admin/menus'
import type {PageData} from '#shared/types/api'

export function createRolesApi(api: AdminApiClient) {
    return {
        listRoles: (query: Record<string, string | number | undefined>) => api.read<PageData<RoleListRecord>>('roles', query),
        getRole: (id: string) => api.read<RoleDetail>(`roles/${id}`),
        getPermissionCatalog: () => api.read<RolePermission[]>('roles/catalog'),
        getRoleMenus: (id: string) => api.read<RoleMenuData>(`roles/${id}/menus`),
        createRole: (body: RoleCreateInput) => api.mutate<{
            id: string
        }>('roles', 'POST', body),
        updateRole: (id: string, body: RoleUpdateInput) => api.mutate<{
            version: number
        }>(`roles/${id}`, 'PUT', body),
        deleteRole: (id: string, version: RoleDeleteInput['version']) => api.mutate(`roles/${id}`, 'DELETE', {version} satisfies RoleDeleteInput),
        assignAuthorization: (id: string, body: RoleAuthorizationInput) => api.mutate<{
            version: number
        }>(`roles/${id}/authorization`, 'PUT', body),
    }
}
