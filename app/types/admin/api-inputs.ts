// 后台 API 适配输入由现有共享 schema 推导，不重复声明字段或引入运行时校验。
import type {z} from 'zod'
import type {userCreateSchema, userUpdateSchema, userRolesSchema, userResetSchema, personalProfileSchema, userDeleteSchema} from '#shared/schemas/admin/users'
import type {roleCreateSchema, roleUpdateSchema, roleAuthorizationSchema, roleDeleteSchema} from '#shared/schemas/admin/roles'
import type {menuCreateSchema, menuUpdateSchema, menuMoveSchema, menuDeleteSchema} from '#shared/schemas/admin/menus'
import type {dictionaryCreateSchema, dictionaryUpdateSchema, dictionaryItemCreateSchema, dictionaryItemUpdateSchema} from '#shared/schemas/admin/dictionaries'

export type UserCreateInput = z.input<typeof userCreateSchema>
export type UserUpdateInput = z.input<typeof userUpdateSchema>
export type UserRolesInput = z.input<typeof userRolesSchema>
export type UserResetInput = z.input<typeof userResetSchema>
export type PersonalProfileInput = z.input<typeof personalProfileSchema>
export type RoleCreateInput = z.input<typeof roleCreateSchema>
export type RoleUpdateInput = z.input<typeof roleUpdateSchema>
export type RoleAuthorizationInput = z.input<typeof roleAuthorizationSchema>
export type MenuCreateInput = z.input<typeof menuCreateSchema>
export type MenuUpdateInput = z.input<typeof menuUpdateSchema>
export type MenuMoveInput = z.input<typeof menuMoveSchema>
export type DictionaryCreateInput = z.input<typeof dictionaryCreateSchema>
export type DictionaryUpdateInput = z.input<typeof dictionaryUpdateSchema>
export type DictionaryItemCreateInput = z.input<typeof dictionaryItemCreateSchema>
export type DictionaryItemUpdateInput = z.input<typeof dictionaryItemUpdateSchema>

export type UserDeleteInput = z.input<typeof userDeleteSchema>

export type RoleDeleteInput = z.input<typeof roleDeleteSchema>

export type MenuDeleteInput = z.input<typeof menuDeleteSchema>
