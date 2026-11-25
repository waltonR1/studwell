// 网站标识和新闻模块的图片槽位规则；区块图片规则由模板合同携带。
import {z} from 'zod'
import {imageRuleSchema} from '../image-presentation'

export const moduleImageRulesSchema = z.strictObject({
    logo: imageRuleSchema,
    favicon: imageRuleSchema,
    newsCover: imageRuleSchema,
    newsBody: imageRuleSchema
})
export type ModuleImageRules = z.infer<typeof moduleImageRulesSchema>
