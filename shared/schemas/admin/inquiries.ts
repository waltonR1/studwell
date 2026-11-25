// 咨询后台的筛选、分配、跟进与回复输入校验，不处理邮件发送或业务授权。
import {z} from 'zod'
import {entityIdSchema, entityVersionSchema} from '../entity'
import {paginationSchema} from './pagination'
import {inquiryCategoryCode, type InquiryCategory, type InquirySubmission} from '../public/inquiries'

export const inquiryStatuses = ['pending', 'awaiting_reply', 'in_progress', 'waiting_customer', 'completed', 'spam'] as const
export const inquiryActions = ['update', 'note', 'external_reply', 'mail_reply', 'mail_retry', 'mail_close'] as const
export const inquiryQueues = ['mine', 'mine_reply', 'unassigned', 'delivery_issue'] as const
export const inquiryListSchema = paginationSchema.safeExtend({
    status: z.enum(inquiryStatuses).optional(),
    category: inquiryCategoryCode.optional(),
    queue: z.enum(inquiryQueues).optional(),
    search: z.string().trim().min(1).max(254).optional(),
    assigneeId: entityIdSchema.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
}).refine(input => !input.from || !input.to || input.from <= input.to, {
    path: ['to'],
    message: '结束日期不能早于开始日期。'
})
export const inquiryUpdateSchema = z.discriminatedUnion('action', [
    z.strictObject({
        action: z.literal('update'),
        version: entityVersionSchema,
        status: z.enum(inquiryStatuses),
        assigneeId: entityIdSchema.nullable()
    }),
    z.strictObject({
        action: z.enum(['note', 'external_reply']),
        version: entityVersionSchema,
        note: z.string().trim().min(1).max(1000)
    }),
    z.strictObject({
        action: z.literal('mail_reply'),
        version: entityVersionSchema,
        body: z.string().trim().min(1).max(3000)
    }),
    z.strictObject({action: z.literal('mail_retry'), version: entityVersionSchema, deliveryId: entityIdSchema}),
    z.strictObject({
        action: z.literal('mail_close'),
        version: entityVersionSchema,
        deliveryId: entityIdSchema,
        reason: z.string().trim().min(1).max(300)
    }),
])

export type InquiryListQuery = z.output<typeof inquiryListSchema>
export type InquiryUpdate = z.output<typeof inquiryUpdateSchema>
export type InquiryStatus = typeof inquiryStatuses[number]
export type InquiryAction = typeof inquiryActions[number]

export interface InquirySummary {
    id: string
    name: string
    category: InquiryCategory
    categoryLabel: string
    status: InquiryStatus
    assigneeId: string | null
    assigneeName: string | null
    createdAt: string
    lastFollowUpAt: string | null
    deliveryIssue: boolean
}

export interface InquiryDetail extends InquirySummary {
    version: number
    email: string
    company: string
    country: string
    message: string
    locale: InquirySubmission['locale']
    canWaitForCustomer: boolean
}

export interface InquiryEvent {
    id: string
    action: InquiryAction
    actorName: string
    note: string
    status: InquiryStatus | null
    assigneeName: string | null
    createdAt: string
}
