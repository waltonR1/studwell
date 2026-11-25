// 任务基础输入合同；调度计算、执行许可和数据库规则继续由后端维护。
import {entityVersionSchema} from '../entity'
import {z} from 'zod'
import {paginationSchema} from './pagination'
import {
    taskCodes,
    runStatuses,
    runTriggers,
    TASK_INTERVAL_MINUTES,
    TASK_RETENTION_DAYS,
    TASK_CRON_MAX_LENGTH
} from '../../config/admin/tasks'

export const taskScheduleSchema = z.discriminatedUnion('mode', [
    z.strictObject({mode: z.literal('daily'), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)}),
    z.strictObject({
        mode: z.literal('interval'),
        minutes: z.number().int().min(TASK_INTERVAL_MINUTES.min).max(TASK_INTERVAL_MINUTES.max)
    }),
    z.strictObject({
        mode: z.literal('cron'),
        expression: z.string().trim().min(9).max(TASK_CRON_MAX_LENGTH).regex(/^[\d*,/\-\s]+$/).refine(value => value.trim().split(/\s+/).length === 5, '使用五字段 Cron：分 时 日 月 周')
    }),
])
export const taskRetentionSchema = z.strictObject({
    login: z.number().int().min(TASK_RETENTION_DAYS.min).max(TASK_RETENTION_DAYS.max),
    audit: z.number().int().min(TASK_RETENTION_DAYS.min).max(TASK_RETENTION_DAYS.max),
    security: z.number().int().min(TASK_RETENTION_DAYS.min).max(TASK_RETENTION_DAYS.max)
})
export const taskUpdateSchema = z.strictObject({
    version: entityVersionSchema,
    schedule: taskScheduleSchema,
    retention: taskRetentionSchema.nullable()
})
export const taskStatusSchema = z.strictObject({version: entityVersionSchema, enabled: z.boolean()})
export const taskRunSchema = z.strictObject({version: entityVersionSchema, confirmed: z.literal(true)})
export const taskControlSchema = z.strictObject({action: z.enum(['stop', 'force']), confirmed: z.literal(true)})
export const taskPreviewSchema = z.strictObject({code: z.enum(taskCodes), schedule: taskScheduleSchema})

export const taskRunQuerySchema = paginationSchema.safeExtend({
    status: z.enum(runStatuses).optional(),
    trigger: z.enum(runTriggers).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional()
}).superRefine((data, ctx) => {
    if ((data.startDate === undefined) !== (data.endDate === undefined) || (data.startDate && data.endDate && data.startDate > data.endDate)) ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: '日期须完整且起始不晚于结束日期。'
    })
})

export type TaskUpdateInput = z.input<typeof taskUpdateSchema>
export type TaskStatusInput = z.input<typeof taskStatusSchema>
export type TaskPreviewInput = z.input<typeof taskPreviewSchema>
export type TaskRunInput = z.input<typeof taskRunSchema>
export type TaskControlInput = z.input<typeof taskControlSchema>
export type TaskRunQueryInput = z.input<typeof taskRunQuerySchema>
export type TaskRunQuery = z.output<typeof taskRunQuerySchema>
