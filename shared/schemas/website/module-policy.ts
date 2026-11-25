// 站点业务能力及区块依赖，由数据库维护；模块名称对应代码已实现的业务能力。
import {z} from 'zod'
import {siteModuleNames} from '../../config/site-modules'
export const siteModuleNameSchema = z.enum(siteModuleNames)
export const siteModuleUpdateSchema = z.strictObject({version:z.number().int().positive(),enabled:z.boolean()})

const names = z.array(z.string().regex(/^[a-z][a-z0-9_.-]{0,99}$/)).refine(values => new Set(values).size === values.length)
export const siteModulesSchema = z.strictObject({news: z.boolean(), careers: z.boolean(), inquiries: z.boolean().default(true)})
export const websiteModulePolicySchema = z.strictObject({
    enabled: siteModulesSchema,
    pages: z.record(z.string(), z.array(siteModuleNameSchema)),
    templates: z.record(z.string(), z.strictObject({
        modules: z.array(siteModuleNameSchema),
        provides: names,
        requires: names
    })),
})
export type WebsiteModulePolicy = z.infer<typeof websiteModulePolicySchema>
