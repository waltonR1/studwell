// 后台字典及选项的输入契约，供管理表单与服务端校验共用；业务接入关系由服务端配置维护。
import {entityVersionSchema, createEntityIdSchema} from '../entity'
import {z} from 'zod'

export const dictionaryCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{2,63}$/, '编码为3–64位小写字母、数字或下划线，以字母开头')
export const dictionaryIdSchema = createEntityIdSchema('ID超出范围')
export const dictionaryFieldsSchema = z.strictObject({
    name: z.string().trim().min(1, '请输入名称').max(80, '名称最多80字符'),
    description: z.string().trim().max(300, '说明最多300字符'),
    enabled: z.boolean()
})
export const dictionaryCreateSchema = dictionaryFieldsSchema.extend({code: dictionaryCodeSchema})
export const dictionaryUpdateSchema = dictionaryFieldsSchema.extend({version: entityVersionSchema})
export const dictionaryItemFieldsSchema = z.strictObject({
    name: z.string().trim().min(1, '请输入名称').max(80, '名称最多80字符'),
    sortOrder: z.number().int().min(0).max(999999),
    enabled: z.boolean()
})
export const dictionaryItemCreateSchema = dictionaryItemFieldsSchema.extend({
    code: dictionaryCodeSchema,
    version: entityVersionSchema
})
export const dictionaryItemUpdateSchema = dictionaryItemFieldsSchema.extend({
    dictionaryId: dictionaryIdSchema,
    version: entityVersionSchema
})
export const dictionaryOptionsQuerySchema = z.strictObject({version: z.string().regex(/^[a-f0-9]{64}$/).optional()})
