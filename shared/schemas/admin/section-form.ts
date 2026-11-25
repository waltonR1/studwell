// 模板编辑布局只接受声明式数据，前端负责通用交互实现。
import {z} from 'zod'
import type {FormField, SectionFormDefinition} from '../../types/admin/section-form'

const text = z.string().max(1000),
    path = z.string().min(1).max(1000).refine(value => value.split('.').every(part => !['__proto__', 'prototype', 'constructor'].includes(part)))
const base = {label: text, help: text.optional(), absolute: z.boolean().optional()}
export const sectionFormFieldSchema: z.ZodType<FormField> = z.lazy(() => z.union([
    z.strictObject({
        ...base,
        kind: z.enum(['text', 'textarea', 'number', 'media', 'link', 'select', 'pattern', 'lines', 'boolean']),
        path,
        key: text.optional(),
        shared: z.boolean().optional(),
        optional: z.boolean().optional(),
        defaultChecked: z.boolean().optional(),
        mediaKind: z.enum(['image', 'video']).optional(),
        options: z.array(z.strictObject({value: text, label: text})).max(1000).optional(),
        token: text.optional(),
        sample: text.optional(),
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
        integer: z.boolean().optional(),
        rows: z.number().int().positive().optional(),
        deriveTelephone: z.boolean().optional(),
        exclusive: z.strictObject({value: text, replacement: text}).optional()
    }),
    z.strictObject({...base, kind: z.literal('slot'), key: text}),
    z.strictObject({
        ...base,
        kind: z.literal('bannerImages'),
        path,
        identityPath: path,
        imagePath: path,
        defaults: z.record(z.string(), z.unknown()),
        videoPath: path.optional()
    }),
    z.strictObject({
        ...base,
        kind: z.literal('collection'),
        path,
        nameLabel: text.optional(),
        presentation: z.literal('table').optional(),
        columns: z.array(z.strictObject({label: text, field: path, editable: z.boolean().optional()})).optional(),
        tree: z.strictObject({
            roots: z.enum(['single', 'multiple']),
            childrenField: path,
            allowReparent: z.boolean(),
            maxDepth: z.number().int().positive().optional(),
            defaultExpanded: z.boolean().optional(),
            showParent: z.boolean().optional(),
            showLevelLabels: z.boolean().optional(),
            levels: z.array(z.strictObject({
                identity: path.optional(),
                itemLabel: text,
                titlePath: path.optional(),
                titleFallback: text.optional(),
                fields: z.array(sectionFormFieldSchema)
            })).min(1)
        }).optional(),
        identity: path.optional(),
        itemLabel: text,
        titlePath: path.optional(),
        fields: z.array(sectionFormFieldSchema).optional(),
        fixedRows: z.array(z.strictObject({
            key: text,
            label: text,
            fields: z.array(sectionFormFieldSchema),
            bindings: z.record(z.string(), z.unknown()).optional()
        })).optional(),
        defaults: z.record(z.string(), z.unknown()).optional()
    }),
])) as z.ZodType<FormField>
export const sectionFormSchema: z.ZodType<SectionFormDefinition> = z.strictObject({
    key: text,
    readOnlyPaths: z.array(path).optional(),
    groups: z.array(z.strictObject({
        title: text,
        help: text.optional(),
        fields: z.array(sectionFormFieldSchema)
    })).max(100)
})
