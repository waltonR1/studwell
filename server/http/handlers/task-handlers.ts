// 适配任务的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery, setResponseStatus} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createTaskService} from '../../services/tasks'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {parseJsonBody, parseParams} from '../validation'
import {entityIdSchema} from '#shared/schemas/entity'
import {taskControlSchema, taskPreviewSchema, taskRunSchema, taskStatusSchema, taskUpdateSchema} from '#shared/schemas/admin/tasks'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function taskHandlers(db: Database, options: AuthHttpOptions, executionAllowed: boolean) {
    const service = createTaskService(db, {executionAllowed}), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    const key = async (event: Parameters<typeof authMeta>[0]) => (await parseParams(event, z.strictObject({id: entityIdSchema}))).id
    return {
        list: defineApiHandler(async event => {
            await parseInput(z.strictObject({}), getQuery(event));
            return service.list(await actor(event))
        }),
        preview: defineApiHandler(async event => service.preview(await actor(event), await parseJsonBody(event, taskPreviewSchema))),
        update: defineApiHandler(async event => service.update(await actor(event), await key(event), await parseJsonBody(event, taskUpdateSchema), authMeta(event, options))),
        status: defineApiHandler(async event => service.status(await actor(event), await key(event), await parseJsonBody(event, taskStatusSchema), authMeta(event, options))),
        run: defineApiHandler(async event => {
            const result = await service.run(await actor(event), await key(event), await parseJsonBody(event, taskRunSchema), authMeta(event, options));
            setResponseStatus(event, 202);
            return result
        }),
        control: defineApiHandler(async event => {
            const result = await service.control(await actor(event), await key(event), await parseJsonBody(event, taskControlSchema), authMeta(event, options));
            setResponseStatus(event, 202);
            return result
        }),
        records: defineApiHandler(async event => service.records(await actor(event), await key(event), getQuery(event))),
        record: defineApiHandler(async event => service.record(await actor(event), await key(event))),
    }
}
