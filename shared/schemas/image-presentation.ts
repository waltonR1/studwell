// 跨端图片规则及取景参数校验；只解释传入规则，不登记固定模板或模块预设。
import {z} from 'zod'
import type {ImageRule, ImagePresentation} from '../types/image-presentation'

const effect = z.strictObject({
    value: z.number().finite().min(0).max(10),
    min: z.number().finite().min(0).max(10),
    max: z.number().finite().min(0).max(10),
    editable: z.boolean()
}).refine(value => value.min <= value.value && value.value <= value.max, '效果默认值应在允许范围内')
export const imageRuleSchema = z.strictObject({
    label: z.string().min(1).max(200),
    fit: z.enum(['cover', 'contain']),
    desktopRatio: z.number().positive().max(100),
    mobileRatio: z.number().positive().max(100),
    mobileEditable: z.boolean(),
    maxZoom: z.number().min(1).max(100),
    opacity: effect.refine(value => value.max <= 1),
    brightness: effect,
    overlay: z.boolean()
})

// 请求先验证通用数值边界，业务服务再使用数据库规则收紧约束。
export function imagePresentationSchema(rule?: ImageRule): z.ZodType<ImagePresentation> {
    const crop = z.strictObject({
        x: z.number().finite().min(0).max(100),
        y: z.number().finite().min(0).max(100),
        zoom: z.number().finite().min(1).max(rule?.maxZoom ?? 100)
    })
    const centered = z.strictObject({x: z.literal(50), y: z.literal(50), zoom: z.literal(1)})
    return z.strictObject({
        desktop: crop.optional(),
        mobile: (rule && !rule.mobileEditable ? centered : crop).optional(),
        opacity: (rule ? (rule.opacity.editable ? z.number().finite().min(rule.opacity.min).max(rule.opacity.max) : z.literal(rule.opacity.value)) : z.number().finite().min(0).max(1)).optional(),
        brightness: (rule ? (rule.brightness.editable ? z.number().finite().min(rule.brightness.min).max(rule.brightness.max) : z.literal(rule.brightness.value)) : z.number().finite().min(0).max(10)).optional()
    }) as z.ZodType<ImagePresentation>
}
