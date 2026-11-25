// 适配字典的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createDictionaryService} from '../../services/dictionaries'
import {defineApiHandler} from '../handler'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseJsonBody, parseParams} from '../validation'
import {parseInput} from '../../core/validation'
import {
    dictionaryCreateSchema,
    dictionaryUpdateSchema,
    dictionaryItemCreateSchema,
    dictionaryItemUpdateSchema,
    dictionaryOptionsQuerySchema
} from '#shared/schemas/admin/dictionaries.ts'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function dictionaryHandlers(db: Database, options: AuthHttpOptions) {
    const dictionaries = createDictionaryService(db), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    const key = async (event: Parameters<typeof authMeta>[0]) => (await parseParams(event, z.strictObject({id: entityIdSchema}))).id
    return {
        list: defineApiHandler(async event => dictionaries.list(await actor(event), getQuery(event))),
        detail: defineApiHandler(async event => {
            await parseInput(z.strictObject({}), getQuery(event));
            return dictionaries.detail(await actor(event), await key(event))
        }),
        create: defineApiHandler(async event => dictionaries.create(await actor(event), await parseJsonBody(event, dictionaryCreateSchema), authMeta(event, options))),
        update: defineApiHandler(async event => dictionaries.update(await actor(event), await key(event), await parseJsonBody(event, dictionaryUpdateSchema), authMeta(event, options))),
        createItem: defineApiHandler(async event => dictionaries.createItem(await actor(event), await key(event), await parseJsonBody(event, dictionaryItemCreateSchema), authMeta(event, options))),
        updateItem: defineApiHandler(async event => dictionaries.updateItem(await actor(event), await key(event), await parseJsonBody(event, dictionaryItemUpdateSchema), authMeta(event, options))),
        options: defineApiHandler(async event => {
            const query = await parseInput(dictionaryOptionsQuerySchema, getQuery(event));
            return dictionaries.options(await actor(event), await key(event), query.version)
        }),
    }
}
