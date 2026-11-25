// 官网咨询提交与公开分类合同；限流、语言范围及业务路由由服务端裁决。
import {z} from 'zod'
import {publicLocaleSchema, type PublicLocale} from './queries'

export const inquiryCategoryCode = z.string().regex(/^[a-z][a-z0-9_-]{0,15}$/)
export type InquiryCategory = z.output<typeof inquiryCategoryCode>
export const inquiryEmail = z.string().trim().max(254).pipe(z.email())

export interface PublicInquiryCategory {
    code: string;
    label: string
}

export const inquirySubmissionSchema = z.strictObject({
    submissionKey: z.uuid(),
    locale: publicLocaleSchema.optional(),
    category: inquiryCategoryCode,
    name: z.string().trim().min(1).max(100),
    email: inquiryEmail,
    company: z.string().trim().max(120),
    country: z.string().trim().max(100),
    message: z.string().trim().min(1).max(3000),
})
export type InquirySubmissionInput = z.output<typeof inquirySubmissionSchema>
export type InquirySubmission = Omit<InquirySubmissionInput, 'locale'> & { locale: PublicLocale }
