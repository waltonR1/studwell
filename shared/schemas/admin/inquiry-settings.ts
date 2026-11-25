// 咨询分类和邮件路由的管理合同；发送、分配及发布规则由服务端执行。
import {localizedSchema} from '../localized'
import {z} from 'zod'
import {entityIdSchema, entityVersionSchema} from '../entity'
import {inquiryCategoryCode, inquiryEmail} from '../public/inquiries'
import {forwardBodyTokens, forwardSubjectTokens} from '../../config/admin/inquiry-forward-template'
import {forwardTemplateProblem} from '../../utils/admin/inquiry-forward-template'

const labelText = z.string().trim().max(80)
const isSingleLine = (value: string) => !/[\r\n]/.test(value)
const label = labelText.refine(isSingleLine)
const singleLineLabel = labelText.refine(isSingleLine)
const address = z.union([z.literal(''), inquiryEmail])
const forwardTemplate = (mode: 'notice' | 'details') => z.strictObject({
    subject: z.string().trim().min(1).max(150).regex(/^[^\x00-\x1f\x7f]+$/),
    body: z.string().trim().min(1).max(6000),
}).superRefine(({subject, body}, ctx) => {
    const subjectProblem = forwardTemplateProblem(subject, forwardSubjectTokens, 150)
    if (subjectProblem) ctx.addIssue({code: 'custom', path: ['subject'], message: subjectProblem})
    const bodyProblem = forwardTemplateProblem(body, forwardBodyTokens[mode], 20_000)
    if (bodyProblem) ctx.addIssue({code: 'custom', path: ['body'], message: bodyProblem})
})
export const inquiryCategorySettingsSchema = z.strictObject({
    code: inquiryCategoryCode,
    labels: localizedSchema(label),
    enabled: z.boolean(),
    forwardTo: address,
    defaultAssigneeId: z.union([z.literal(''), entityIdSchema]),
})
export const inquiryCategoryDraftSchema = inquiryCategorySettingsSchema.extend({
    labels: localizedSchema(singleLineLabel),
})
export const inquiryForwardTemplatesSchema = z.strictObject({
    notice: forwardTemplate('notice'),
    details: forwardTemplate('details'),
})
export const inquirySettingsSchema = z.strictObject({
    categories: z.array(inquiryCategorySettingsSchema).max(50),
    mail: z.strictObject({
        forwardEnabled: z.boolean(),
        replyEnabled: z.boolean(),
        assignmentEnabled: z.boolean(),
        from: address,
        defaultRecipient: address,
        replyMailbox: address,
        forwardRoute: z.enum(['default', 'category']),
        forwardContent: z.enum(['notice', 'details']),
        forwardTemplates: inquiryForwardTemplatesSchema,
        replyRoute: z.enum(['default', 'category', 'assignee']),
    }),
}).superRefine(({categories, mail}, ctx) => {
    if (new Set(categories.map(item => item.code)).size !== categories.length)
        ctx.addIssue({code: 'custom', path: ['categories'], message: '咨询类型代码不能重复。'})
    if ((mail.forwardEnabled || mail.replyEnabled || mail.assignmentEnabled) && !mail.from)
        ctx.addIssue({code: 'custom', path: ['mail', 'from'], message: '请填写统一发件地址。'})
    if (mail.forwardEnabled && !mail.defaultRecipient)
        ctx.addIssue({code: 'custom', path: ['mail', 'defaultRecipient'], message: '请填写默认转发邮箱。'})
    if (mail.replyEnabled && !mail.replyMailbox)
        ctx.addIssue({code: 'custom', path: ['mail', 'replyMailbox'], message: '请填写接收客户回信的邮箱。'})
})
export const inquirySettingsUpdateSchema = z.strictObject({
    version: entityVersionSchema,
    settings: inquirySettingsSchema
})
export type InquirySettings = z.output<typeof inquirySettingsSchema>
export type InquirySettingsUpdate = z.output<typeof inquirySettingsUpdateSchema>
export type InquirySettingsView = InquirySettingsUpdate & {
    transportConfigured: boolean;
    forwardTemplateDefaults: InquirySettings['mail']['forwardTemplates'];
    assignees: { id: string; name: string }[]
}
export const inquiryMailKinds = ['forward', 'reply', 'assignment'] as const
export type InquiryMailKind = typeof inquiryMailKinds[number]
export type InquiryMailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'uncertain'

export interface InquiryMailResolution {
    reason: string
    actorId: string
    actorName: string
    at: string
}

export interface InquiryMailRecord {
    id: string
    kind: InquiryMailKind
    status: InquiryMailStatus
    recipient: string
    body: string
    attempts: number
    createdAt: string
    sentAt: string | null
    resolution: InquiryMailResolution | null
}
