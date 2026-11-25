// 账号管理 Handler：当前 Session 身份、HTTP/Zod 和私有密码策略入口。
import {getQuery} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createUserService} from '../../services/users'
import {defineApiHandler} from '../handler'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseJsonBody, parseParams} from '../validation'
import {
    userCreateSchema,
    userUpdateSchema,
    userResetSchema,
    userRolesSchema,
    userDeleteSchema
} from '../../../shared/schemas/admin/users'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function userHandlers(db: Database, options: AuthHttpOptions, checkBlocklist?: boolean) {
    const users = createUserService(db, checkBlocklist), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    const key = async (event: Parameters<typeof authMeta>[0]) => (await parseParams(event, z.strictObject({id: entityIdSchema}))).id
    return {
        list: defineApiHandler(async event => users.list(await actor(event), getQuery(event))),
        detail: defineApiHandler(async event => users.detail(await actor(event), await key(event))),
        catalog: defineApiHandler(async event => users.catalog(await actor(event))),
        profileCatalog: defineApiHandler(async event => users.profileCatalog(await actor(event))),
        create: defineApiHandler(async event => users.create(await actor(event), await parseJsonBody(event, userCreateSchema), authMeta(event, options))),
        update: defineApiHandler(async event => users.update(await actor(event), await key(event), await parseJsonBody(event, userUpdateSchema), authMeta(event, options))),
        roles: defineApiHandler(async event => users.assignRoles(await actor(event), await key(event), await parseJsonBody(event, userRolesSchema), authMeta(event, options))),
        password: defineApiHandler(async event => users.resetPassword(await actor(event), await key(event), await parseJsonBody(event, userResetSchema), authMeta(event, options))),
        remove: defineApiHandler(async event => users.remove(await actor(event), await key(event), await parseJsonBody(event, userDeleteSchema), authMeta(event, options))),
    }
}
