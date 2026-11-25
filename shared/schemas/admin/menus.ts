// 后台菜单表单与授权操作的输入契约，供前后端共用；编码和页面绑定仅在创建时接受。
import {MAX_MENU_SORT_ORDER} from '../../config/admin/menus'
import {entityVersionSchema, entityVersionBodySchema, entityIdSchema} from '../entity'
import {z} from 'zod'
import {menuIconOptions} from '../../config/admin/menu-icons'

export const menuIconSchema = z.enum(menuIconOptions.map(option => option.key), {
    error: issue => issue.input === undefined || issue.input === null || issue.input === ''
        ? '请选择菜单图标'
        : '所选图标不可用，请重新选择'
})
const id = entityIdSchema
export const menuFieldsSchema = z.strictObject({
    iconKey: menuIconSchema,
    name: z.string().trim().min(1, '请输入菜单名称').max(80, '名称最多 80 字符'),
    parentId: id.nullable(),
    sortOrder: z.number().int().min(0).max(MAX_MENU_SORT_ORDER),
    visible: z.boolean()
})
export const menuCreateSchema = menuFieldsSchema.extend({
    code: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/, '编码须为 3–64 位小写字母、数字或下划线，且以字母开头'),
    pageKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/).nullable()
})
export const menuUpdateSchema = menuFieldsSchema.extend({version: entityVersionSchema})
export const menuDeleteSchema = entityVersionBodySchema

export const menuMoveSchema = z.strictObject({
    version: entityVersionSchema,
    neighborId: id,
    neighborVersion: entityVersionSchema,
    direction: z.enum(['up', 'down'])
})
