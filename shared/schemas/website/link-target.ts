// 页面、锚点、业务入口及自定义网址的通用链接校验，不包含后台选择器文案。
import {z} from 'zod'
import {isSiteLinkAddress} from '../../utils/website/site-link'

// Every internal destination has an explicit page identity.
export const internalLinkTargetSchema = z.strictObject({
    type: z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/).refine(value => value !== 'custom'),
    module: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    resourceId: z.string().regex(/^[1-9][0-9]{0,19}$/),
    value: z.string().max(100).regex(/^[a-zA-Z0-9_-]*$/),
}).superRefine((target, ctx) => {
    if (target.type === 'page' ? !!target.value : !target.value) ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: '请选择有效的页面或栏目'
    })
})
export const linkTargetSchema = z.union([internalLinkTargetSchema, z.strictObject({
    type: z.literal('custom'),
    value: z.string().trim().max(2000).refine(isSiteLinkAddress, '请输入有效的 HTTP(S) 网址或站内路径')
})])
export type LinkTarget = z.infer<typeof linkTargetSchema>
