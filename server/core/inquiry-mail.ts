// 咨询邮件信封与传输接口合同，不绑定具体 SMTP 实现。
export interface InquiryEnvelope {id: bigint; sender: string; recipient: string; replyTo: string; subject: string; body: string}
export type InquiryTransport = (message: InquiryEnvelope) => Promise<'sent' | 'retry' | 'failed' | 'uncertain'>
