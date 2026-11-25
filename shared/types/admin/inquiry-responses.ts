// 咨询管理详情、流转、邮件和操作结果响应，不包含客户端弹窗状态。
import type {InquiryDetail, InquiryEvent, InquirySummary} from '../../schemas/admin/inquiries'
import type {InquiryMailKind, InquiryMailRecord} from '../../schemas/admin/inquiry-settings'
import type {PageData} from '../api'

export interface InquiryAssignee {
    id: string;
    name: string
}

export interface InquiryInbox extends PageData<InquirySummary> {
    categories: { code: string; label: string; enabled: boolean }[]
    assignees: InquiryAssignee[]
}

export interface InquiryDetailResponse {
    inquiry: InquiryDetail
    history: InquiryEvent[]
    mail: InquiryMailRecord[]
    mailKinds: InquiryMailKind[]
    replyAddress: string
}

export type InquiryDetailReadResponse = InquiryDetailResponse & { assignees: InquiryAssignee[] }
