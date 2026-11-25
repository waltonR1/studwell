// 模板字段与图片规则的数据库合同，编辑、导入和发布共用。
import {z} from 'zod'
import type {SectionField} from '../../types/website/section-template'
import {imageRuleSchema} from '../image-presentation'

export const sectionFieldSchema: z.ZodType<SectionField> = z.lazy(() => z.object({
    kind: z.enum(['group', 'tree', 'list', 'text', 'number', 'media', 'boolean', 'link']),
    label: z.string(),
    searchable: z.boolean().optional(),
    mediaKind: z.enum(['image', 'video']).optional(),
    imagePreset: imageRuleSchema.optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxDepth: z.number().int().positive().optional(),
    required: z.boolean().optional(),
    optional: z.boolean().optional(),
    fields: z.record(z.string(), sectionFieldSchema).optional(),
    item: sectionFieldSchema.optional(),
}).superRefine((field, context) => {
    if ((field.kind === 'group' || field.kind === 'tree') && !field.fields || field.kind === 'list' && !field.item) context.addIssue({
        code: 'custom',
        message: 'Invalid published field definition'
    })
})) as z.ZodType<SectionField>

export function publishedFieldDefinition(value: unknown): SectionField {
    const pending = [{value, depth: 0}], seen = new Set<object>()
    while (pending.length) {
        const entry = pending.pop()!
        if (!entry.value || typeof entry.value !== 'object') continue
        if (seen.has(entry.value) || seen.size >= 10000 || entry.depth > 128) throw new Error('Invalid published field definition')
        seen.add(entry.value)
        const field = entry.value as { fields?: Record<string, unknown>; item?: unknown }
        for (const child of Object.values(field.fields ?? {})) pending.push({value: child, depth: entry.depth + 1})
        if (field.item) pending.push({value: field.item, depth: entry.depth + 1})
    }
    return sectionFieldSchema.parse(value)
}

// 公共装配合同不包含后台控件、编辑布局或预览组件。
export const sectionTemplateSchema = z.strictObject({
    key: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    allowedPages: z.union([z.literal('all'), z.array(z.string())]),
    dataSource: z.enum(['news']).nullable(),
    fields: sectionFieldSchema,
    mediaSlots: z.array(z.strictObject({
        key: z.string(),
        name: z.string(),
        kind: z.enum(['image', 'video']),
        imagePreset: imageRuleSchema.optional()
    })),
    banner: z.strictObject({
        family: z.string(),
        videoPath: z.string().optional(),
        stripPaths: z.array(z.string()).optional(),
        referenceDefaults: z.record(z.string(), z.string()).optional()
    }).optional(),
})
