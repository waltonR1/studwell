// 后台角色编辑与授权操作的共享输入契约；业务授权由服务端最终裁决。
import {entityVersionSchema, entityVersionBodySchema, entityIdSchema} from '../entity'
import {z} from 'zod'

export const roleCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/, '编码须为 3–64 位小写字母、数字或下划线，且以字母开头').refine(value => value !== 'root', 'root 为保留编码')
export const roleFieldsSchema = z.strictObject({
    name: z.string().trim().min(1, '请输入角色名称').max(80, '名称最多 80 字符'),
    enabled: z.boolean()
})
export const roleCreateSchema = roleFieldsSchema.extend({code: roleCodeSchema})
export const roleUpdateSchema = roleFieldsSchema.extend({version: entityVersionSchema})
export const roleDeleteSchema = entityVersionBodySchema
export const roleAuthorizationSchema = z.strictObject({
    version: entityVersionSchema,
    permissions: z.array(z.string().regex(/^[a-z][a-z0-9_.]{2,79}$/)).max(100).refine(values => new Set(values).size === values.length, '权限不能重复'),
    menuIds: z.array(entityIdSchema).max(500).refine(values => new Set(values).size === values.length, '菜单不能重复')
})
