// 适配个人资料的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createPersonalProfileService} from '../../services/personal-profile'
import {personalProfileSchema} from '#shared/schemas/admin/users.ts'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'
import {defineApiHandler} from '../handler'
import {parseJsonBody} from '../validation'

export function personalProfileHandlers(db: Database, options: AuthHttpOptions) {
    const auth = createAuthService(db), profile = createPersonalProfileService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    return {
        read: defineApiHandler(async event => profile.read(await actor(event))),
        update: defineApiHandler(async event => profile.update(await actor(event), await parseJsonBody(event, personalProfileSchema), authMeta(event, options))),
    }
}
