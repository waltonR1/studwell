// 咨询列表与投递记录的展示标签、状态颜色和筛选选项，不承载业务状态。
import {inquiryStatuses,type InquiryStatus} from '#shared/schemas/admin/inquiries'
import type {InquiryMailKind,InquiryMailStatus} from '#shared/schemas/admin/inquiry-settings'
export const statuses: Record<InquiryStatus, string> = {pending:'待处理', awaiting_reply:'待我方回复', in_progress:'处理中', waiting_customer:'等待客户', completed:'已完成', spam:'垃圾'}
export const statusTones = {pending:'warning', awaiting_reply:'warning', in_progress:'neutral', waiting_customer:'neutral', completed:'success', spam:'danger'} as const
export const actionNames = {update:'更新处理状态或负责人', note:'添加跟进备注', external_reply:'人工登记已在外部回复', mail_reply:'提交后台邮件回复', mail_retry:'重试邮件投递', mail_close:'关闭投递异常'}
export const mailStatuses: Record<InquiryMailStatus, string> = {queued:'待投递', sending:'投递中', sent:'邮件服务器已接收', failed:'投递失败', uncertain:'投递结果待确认'}
export const mailLabels: Record<InquiryMailKind, string> = {forward:'新咨询转发', reply:'回复客户', assignment:'负责人提醒'}
export const queues = [{value:'',label:'全部咨询'},{value:'mine_reply',label:'我的待回复'},{value:'mine',label:'我的待处理'},{value:'unassigned',label:'未认领'},{value:'delivery_issue',label:'投递异常'}]
export const statusOptions = inquiryStatuses.map(value => ({value, label:statuses[value]}))
