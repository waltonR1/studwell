// 适配environment的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createEnvironmentService} from '../../services/environment'
import {defineApiHandler} from '../handler'
import {parseInput} from '../../core/validation'
import {requestActor} from '../auth'

export function environmentHandlers(database: Database) {
    const environment = createEnvironmentService(database), auth = createAuthService(database)
    return {
        overview: defineApiHandler(async event => {
            await parseInput(z.strictObject({}), getQuery(event))
            return environment.overview(await requestActor(event, auth))
        }),
    }
}
