// 账号与个人资料接口；前端表单状态和权限展示由调用方持有。
import type {UserCreateInput, UserUpdateInput, PersonalProfileInput, UserRolesInput, UserResetInput, UserDeleteInput} from '~/types/admin/api-inputs'
import type {AdminApiClient} from '~/types/admin/api'
import type {UserRecord, UserDetail, UserListRecord, UserRoleOption, PersonalProfile} from '#shared/types/admin/users'
import type {AccountDictionaryCatalog} from '#shared/types/admin/dictionaries'
import type {PageData} from '#shared/types/api'

export function createUsersApi(api: AdminApiClient) {
    return {
        listUsers: (query: Record<string, string | number | undefined>) => api.read<PageData<UserListRecord>>('users', query),
        getUser: (id: string) => api.read<UserDetail>(`users/${id}`),
        getRoleCatalog: () => api.read<UserRoleOption[]>('users/catalog'),
        getProfileCatalog: () => api.read<AccountDictionaryCatalog>('users/profile-catalog'),
        createUser: (body: UserCreateInput) => api.mutate<UserRecord>('users', 'POST', body),
        updateUser: (id: string, body: UserUpdateInput) => api.mutate<UserRecord>(`users/${id}`, 'PUT', body),
        updateSection: (id: string, section: 'profile' | 'status' | 'roles' | 'password', body: UserUpdateInput | UserRolesInput | UserResetInput) => api.mutate<UserRecord>(`users/${id}${section === 'roles' ? '/roles' : section === 'password' ? '/password' : ''}`, section === 'password' ? 'POST' : 'PUT', body),
        deleteUser: (id: string, version: UserDeleteInput['version']) => api.mutate(`users/${id}`, 'DELETE', {version} satisfies UserDeleteInput),
        getPersonalProfile: () => api.read<PersonalProfile>('auth/profile'),
        updatePersonalProfile: (body: PersonalProfileInput) => api.mutate<PersonalProfile>('auth/profile', 'PUT', body),
    }
}
