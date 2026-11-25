// 适配角色的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {createRoleAuthorizationService} from '../../services/role-authorization'
// Handler 仅承担 HTTP/Zod/Session 身份入口，规则和持久化交给 Service/Repository。
import {getQuery} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createRoleService} from '../../services/roles'
import {defineApiHandler} from '../handler'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseJsonBody, parseParams} from '../validation'
import {roleCreateSchema, roleUpdateSchema, roleDeleteSchema, roleAuthorizationSchema} from '#shared/schemas/admin/roles.ts'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function roleHandlers(db: Database, options: AuthHttpOptions) {
    const roles = createRoleService(db), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    const authorization = createRoleAuthorizationService(db)
    const key = async (event: Parameters<typeof authMeta>[0]) => (await parseParams(event, z.strictObject({id: entityIdSchema}))).id
    return {
        roleMenus: defineApiHandler(async event => authorization.roleMenus(await actor(event), await key(event))),
        assignRoleAuthorization: defineApiHandler(async event => authorization.assignRoleAuthorization(await actor(event), await key(event), await parseJsonBody(event, roleAuthorizationSchema), authMeta(event, options))),
        list: defineApiHandler(async event => roles.list(await actor(event), getQuery(event))),
        detail: defineApiHandler(async event => roles.detail(await actor(event), await key(event))),
        catalog: defineApiHandler(async event => roles.catalog(await actor(event))),
        create: defineApiHandler(async event => roles.create(await actor(event), await parseJsonBody(event, roleCreateSchema), authMeta(event, options))),
        update: defineApiHandler(async event => roles.update(await actor(event), await key(event), await parseJsonBody(event, roleUpdateSchema), authMeta(event, options))),
        remove: defineApiHandler(async event => roles.remove(await actor(event), await key(event), await parseJsonBody(event, roleDeleteSchema), authMeta(event, options))),
    }
}
