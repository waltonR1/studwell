// 适配系统参数的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createParameterService} from '../../services/parameters'
import {defineApiHandler} from '../handler'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseJsonBody, parseParams} from '../validation'
import {parseInput} from '../../core/validation'
import {parameterUpdateSchema, parameterBatchSchema, preferenceQuerySchema} from '#shared/schemas/admin/parameters'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function parameterHandlers(db: Database, options: AuthHttpOptions) {
    const parameters = createParameterService(db), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    return {
        list: defineApiHandler(async event => {
            await parseInput(z.strictObject({}), getQuery(event));
            return parameters.list(await actor(event))
        }),
        preferences: defineApiHandler(async event => {
            const query = await parseInput(preferenceQuerySchema, getQuery(event));
            return parameters.preferences(await actor(event), query.version)
        }),
        batch: defineApiHandler(async event => parameters.batch(await actor(event), await parseJsonBody(event, parameterBatchSchema), authMeta(event, options))),
        update: defineApiHandler(async event => parameters.update(await actor(event), (await parseParams(event, z.strictObject({id: entityIdSchema}))).id, await parseJsonBody(event, parameterUpdateSchema), authMeta(event, options))),
    }
}
