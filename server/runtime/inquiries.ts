// 从运行配置装配咨询邮件传输依赖，供请求入口使用。
import type {H3Event} from 'h3'
import {useRuntimeConfig} from '#imports'
import {inquirySmtpConfigured} from '../infrastructure/inquiry-smtp'

export function inquiryTransportConfigured(event: H3Event) {
    return inquirySmtpConfigured(useRuntimeConfig(event).inquirySmtpUrl)
}
