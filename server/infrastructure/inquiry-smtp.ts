// 将咨询邮件传输合同适配到 SMTP，配置由调用方提供。
import nodemailer from 'nodemailer'
import type {InquiryTransport} from '../core/inquiry-mail'

function smtpOptions(raw: string) {
    try {
        const url = new URL(raw)
        if (!['smtp:', 'smtps:'].includes(url.protocol) || !url.hostname || url.search || url.hash
            || (url.pathname && url.pathname !== '/') || !url.username || !url.password) return null
        const secure = url.protocol === 'smtps:'
        const port = url.port ? Number(url.port) : secure ? 465 : 587
        if (!Number.isInteger(port) || port < 1 || port > 65535) return null
        return {host: url.hostname.replace(/^\[|\]$/g, ''), port, secure, requireTLS: !secure,
            auth: {user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password)},
            connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000, dnsTimeout: 10_000,
            disableFileAccess: true, disableUrlAccess: true}
    } catch { return null }
}

export const inquirySmtpConfigured = (url: string) => smtpOptions(url) !== null

export function createInquirySmtp(url: string): InquiryTransport | undefined {
    const options = smtpOptions(url)
    if (!options) return undefined
    const smtp = nodemailer.createTransport(options)
    return async message => {
        try {
            const result = await smtp.sendMail({
                from: message.sender, to: message.recipient, replyTo: message.replyTo,
                subject: message.subject, text: message.body,
                messageId: '<inquiry-' + message.id + '@' + message.sender.split('@').at(-1) + '>',
            })
            return result.accepted.length ? 'sent' : 'failed'
        } catch (error) {
            const {responseCode} = error as {responseCode?: number}
            if (responseCode && responseCode >= 400 && responseCode < 500) return 'retry'
            if (responseCode && responseCode >= 500) return 'failed'
            return 'uncertain'
        }
    }
}
