// 数据库模板修订的后台完整合同；公共模板合同不反向依赖此文件。
import {z} from 'zod'
import {sectionTemplateSchema} from '../website/section-template'
import {sectionFormSchema} from './section-form'

export const sectionTemplateRevisionSchema = sectionTemplateSchema.extend({
    category: z.string().min(1).max(100).optional(),
    preview: z.strictObject({pageKey: z.string()}),
    editor: sectionFormSchema.nullable(),
    publicRendererId: z.string().min(1),
    previewRendererId: z.string().min(1)
}).refine(value => !value.editor || value.editor.key === value.key, '编辑布局必须属于当前模板')
