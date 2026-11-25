// 适配公开咨询的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {inquirySubmissionSchema} from '#shared/schemas/public/inquiries'
import {publicLocalizedQuerySchema} from '#shared/schemas/public/queries'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createInquiryService} from '../../services/inquiries'
import {publicInquiryCategories} from '../../services/inquiry-settings'
import {authMeta, type AuthHttpOptions} from '../auth'
import {defineApiHandler} from '../handler'
import {parseJsonBody, parseQuery} from '../validation'

export function publicInquiryHandler(db: Database, options: AuthHttpOptions) {
    return defineApiHandler(async event => {
        const meta = authMeta(event, options)
        await createAuthService(db).limit('public-inquiry', meta.ip, meta)
        const input = await parseJsonBody(event, inquirySubmissionSchema)
        return createInquiryService(db, false, options.origin).submit(input)
    })
}

export function publicInquiryCategoriesHandler(db: Database) {
    return defineApiHandler(async event => {
        const {locale} = await parseQuery(event, publicLocalizedQuerySchema)
        return db.transaction(tx=>publicInquiryCategories(tx,locale),{isolationLevel:'repeatable read'})
    })
}
