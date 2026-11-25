// 适配咨询的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getRouterParam} from 'h3'
import {entityIdSchema} from '#shared/schemas/entity'
import {inquiryListSchema, inquiryUpdateSchema} from '#shared/schemas/admin/inquiries'
import type {Database} from '../../db/transaction'
import {parseInput} from '../../core/validation'
import {createAuthService} from '../../services/auth'
import {createInquiryService} from '../../services/inquiries'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'
import {defineApiHandler} from '../handler'
import {parseJsonBody, parseQuery} from '../validation'

export function inquiryHandler(db: Database, options: AuthHttpOptions, action: 'list' | 'get' | 'update', transportConfigured = false) {
    return defineApiHandler(async event => {
        const actor = await requestActor(event, createAuthService(db))
        const service = createInquiryService(db, transportConfigured, options.origin)
        if (action === 'list') return service.list(actor, await parseQuery(event, inquiryListSchema))
        const id = await parseInput(entityIdSchema, getRouterParam(event, 'id'))
        if (action === 'get') return service.get(actor, id)
        return service.update(actor, authMeta(event, options), id, await parseJsonBody(event, inquiryUpdateSchema))
    })
}
