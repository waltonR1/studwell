// 招聘后台的岗位内容、保存、发布及历史操作输入校验；公开响应另在 types/public。
import {localizedSchema} from '../localized'
import {z} from 'zod'
import {entityIdSchema} from '../entity'

import {supportedLocales} from '../../config/site-languages'

export const careerLocales = supportedLocales
const line = z.string().trim().max(10000)
export const careerTranslationSchema = z.strictObject({
    title: line, department: line, location: line,
    responsibilities: z.array(z.string().trim().min(1).max(10000)).max(100),
    requirements: z.array(z.string().trim().min(1).max(10000)).max(100),
})
const translation = careerTranslationSchema
export const careerContentSchema = z.strictObject({
    sortOrder: z.number().int().min(0).max(1000000),
    localized: localizedSchema(translation),
})
export const careerVersionSchema = z.number().int().positive().max(4294967295)
export const careerCreateSchema = z.strictObject({content: careerContentSchema})
export const careerUpdateSchema = careerCreateSchema.extend({version: careerVersionSchema})
export const careerActionSchema = z.strictObject({
    version: careerVersionSchema,
    publishedReleaseId: entityIdSchema.nullable()
})
export const careerMoveSchema = z.strictObject({
    version: careerVersionSchema,
    neighborId: entityIdSchema,
    neighborVersion: careerVersionSchema,
    direction: z.enum(['up', 'down']),
})
export const careerPositionQuerySchema = z.strictObject({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).default(''),
    status: z.enum(['all', 'published', 'unpublished']).default('all'),
})
export type CareerContent = z.infer<typeof careerContentSchema>
export type CareerTranslation = z.infer<typeof careerTranslationSchema>

export interface CareerPositionQuery {
    page?: number
    pageSize?: number
    search?: string
    status?: 'all' | 'published' | 'unpublished'
}

export interface AdminCareerPosition {
    id: string;
    content: CareerContent;
    version: number;
    publishedReleaseId: string | null;
    changed: boolean
}
