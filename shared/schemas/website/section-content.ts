// 根据字段合同校验区块内容，供编辑、导入与公开投影使用。
import {z} from 'zod'
import {linkTargetSchema} from './link-target'
import {entityIdSchema} from '../entity'
import type {SectionField} from '../../types/website/section-template'
import {imagePresentationSchema} from '../image-presentation'

// Registered, bounded field shapes; no unvalidated JSON or executable expressions.
export function sectionContentSchema(field: SectionField): z.ZodType {
    if (field.kind === 'tree') {
        const shape = Object.fromEntries(Object.entries(field.fields).map(([key, f]) => [key, f.optional ? sectionContentSchema(f).optional() : sectionContentSchema(f)]))
        const node: z.ZodType = z.lazy(() => z.strictObject({...shape, children: z.array(node).optional()}))
        return z.preprocess((raw, context) => {
            const pending = [{value: raw, depth: 0}], seen = new Set<object>(), ids = new Set<string>();
            let count = 0
            while (pending.length) {
                const {value, depth} = pending.pop()!
                if (!value || typeof value !== 'object') continue
                const item = value as { id?: unknown; children?: unknown }
                if (seen.has(value) || ++count > (field.max ?? 2000) || depth > (field.maxDepth ?? 128)) {
                    context.addIssue({code: 'custom', message: '节点关系重复或结构过大，请拆分后保存。'});
                    return z.NEVER
                }
                seen.add(value)
                if (typeof item.id === 'string' && item.id) {
                    if (ids.has(item.id)) {
                        context.addIssue({code: 'custom', message: '节点标识不能重复。'});
                        return z.NEVER
                    }
                    ids.add(item.id)
                }
                if (Array.isArray(item.children)) for (const child of item.children) pending.push({
                    value: child,
                    depth: depth + 1
                })
            }
            return raw
        }, node)
    }
    if (field.kind === 'group') return z.strictObject(Object.fromEntries(Object.entries(field.fields ?? {}).map(([key, f]) => [key, f.optional ? sectionContentSchema(f).optional() : sectionContentSchema(f)])))
    if (field.kind === 'list') return z.array(sectionContentSchema(field.item!)).max(field.max ?? 100)
    if (field.kind === 'media') return z.strictObject({mediaId: entityIdSchema.nullable(), ...(field.imagePreset ? {presentation: imagePresentationSchema(field.imagePreset).optional()} : {})})
    if (field.kind === 'number') {
        let schema = z.number().finite()
        if (field.min !== undefined) schema = schema.min(field.min)
        if (field.max !== undefined) schema = schema.max(field.max)
        return schema
    }
    if (field.kind === 'link') return linkTargetSchema.nullable()
    if (field.kind === 'boolean') return z.boolean()
    return z.string().max(field.max ?? 10000)
}
