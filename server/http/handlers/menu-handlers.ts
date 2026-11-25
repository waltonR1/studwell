// 菜单 Handler：只处理身份、输入合同与 HTTP，规则下沉到 Service。
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createMenuService} from '../../services/menus'
import {defineApiHandler} from '../handler'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseJsonBody, parseParams} from '../validation'
import {menuCreateSchema, menuUpdateSchema, menuMoveSchema, menuDeleteSchema} from '#shared/schemas/admin/menus.ts'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function menuHandlers(db: Database, options: AuthHttpOptions) {
    const service = createMenuService(db), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    const key = async (event: Parameters<typeof authMeta>[0]) => (await parseParams(event, z.strictObject({id: entityIdSchema}))).id
    return {
        list: defineApiHandler(async event => service.list(await actor(event))),
        catalog: defineApiHandler(async event => service.catalog(await actor(event))),
        navigation: defineApiHandler(async event => service.navigation(await actor(event))),
        create: defineApiHandler(async event => service.create(await actor(event), await parseJsonBody(event, menuCreateSchema), authMeta(event, options))),
        update: defineApiHandler(async event => service.update(await actor(event), await key(event), await parseJsonBody(event, menuUpdateSchema), authMeta(event, options))),
        move: defineApiHandler(async event => service.move(await actor(event), await key(event), await parseJsonBody(event, menuMoveSchema), authMeta(event, options))),
        remove: defineApiHandler(async event => service.remove(await actor(event), await key(event), await parseJsonBody(event, menuDeleteSchema), authMeta(event, options))),
    }
}
