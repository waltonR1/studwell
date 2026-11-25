// 适配咨询设置的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {inquirySettingsUpdateSchema} from '#shared/schemas/admin/inquiry-settings'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {getInquirySettings, updateInquirySettings} from '../../services/inquiry-settings'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'
import {defineApiHandler} from '../handler'
import {parseJsonBody} from '../validation'

export function inquirySettingsHandler(db: Database, options: AuthHttpOptions, action: 'get' | 'update', transportConfigured: boolean) {
    return defineApiHandler(async event => {
        const actor = await requestActor(event, createAuthService(db))
        if (action === 'get') return getInquirySettings(db, actor, transportConfigured)
        const input = await parseJsonBody(event, inquirySettingsUpdateSchema, 128 * 1024)
        return updateInquirySettings(db, actor, authMeta(event, options), input, transportConfigured)
    })
}
