// 后台账号管理与本人资料的共享输入契约；密码仅用于写入，动态密码策略由服务端校验。
import {entityVersionSchema, entityIdSchema} from '../entity'
import {z} from 'zod'
import {isPasswordLengthValid} from '../../utils/admin/password'
import {PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH} from '../../config/admin/password'

// 账号创建、登录和基础账号服务共用的用户名规范化与格式约束。
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,64}$/, '用户名须为 3–64 位字母、数字或下划线')
export const userPasswordSchema = z.string().refine(isPasswordLengthValid, `密码须为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 个字符`)
const optionalText = (max: number) => z.string().trim().max(max, `最多 ${max} 个字符`).nullable().optional().transform(value => value === '' ? null : value)
export const userExtraFields = {
    phone: optionalText(32),
    department: optionalText(80),
    position: optionalText(80),
    remark: optionalText(500)
}
export const userProfileSchema = z.strictObject({
    displayName: z.string().trim().min(1, '请输入显示名称').max(80),
    email: z.email({error: '请输入有效邮箱'}).max(254).nullable(), ...userExtraFields,
    enabled: z.boolean()
})
export const userCreateSchema = z.strictObject({
    username: usernameSchema,
    displayName: userProfileSchema.shape.displayName,
    email: userProfileSchema.shape.email, ...userExtraFields,
    password: userPasswordSchema
})
export const userUpdateSchema = userProfileSchema.partial().extend({version: entityVersionSchema}).refine(value => Object.entries(value).some(([key, item]) => key !== 'version' && item !== undefined), '请提供要修改的字段')
export const userResetSchema = z.strictObject({version: entityVersionSchema, password: userPasswordSchema})
const id = entityIdSchema
export const userRolesSchema = z.strictObject({
    version: entityVersionSchema,
    roleIds: z.array(id).max(100).refine(values => new Set(values).size === values.length, '角色不能重复')
})
export const userDeleteSchema = z.strictObject({version: entityVersionSchema})
// 本人资料严格限定字段，不接受账号 ID、角色、状态或管理资料。
export const personalProfileSchema = z.strictObject({
    version: entityVersionSchema,
    displayName: userProfileSchema.shape.displayName,
    email: userProfileSchema.shape.email,
    phone: userExtraFields.phone,
    department: userExtraFields.department,
    position: userExtraFields.position
})
