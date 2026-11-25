// 适配日志的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {defineEventHandler, getQuery, setResponseHeader} from 'h3'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createLogService} from '../../services/logs'
import type {LogKind} from '#shared/types/admin/logs'
import {logExportSchema} from '#shared/schemas/admin/logs.ts'
import {defineApiHandler, apiErrorResponse} from '../handler'
import {ensureRequestId} from '../request-id'
import {entityIdSchema} from '#shared/schemas/entity'
import {parseParams, parseJsonBody} from '../validation'
import {parseInput} from '../../core/validation'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

export function logHandlers(db: Database, options: AuthHttpOptions, kind: LogKind) {
    const logs = createLogService(db), auth = createAuthService(db)

    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth)

    return {
        list: defineApiHandler(async event => logs.list(await actor(event), kind, getQuery(event))),
        detail: defineApiHandler(async event => {
            await parseInput(z.strictObject({}), getQuery(event));
            const params = await parseParams(event, z.strictObject({id: entityIdSchema}));
            return logs.detail(await actor(event), kind, params.id)
        }),
        export: defineEventHandler(async event => {
            ensureRequestId(event);
            setResponseHeader(event, 'Cache-Control', 'no-store')
            try {
                await parseInput(z.strictObject({}), getQuery(event))
                const file = await logs.export(await actor(event), kind, await parseJsonBody(event, logExportSchema), authMeta(event, options))
                // CSV是成功响应的特殊媒体类型；所有失败仍使用标准JSON合同，成功审计提交前不发文件头。
                setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
                setResponseHeader(event, 'Content-Disposition', `attachment; filename="${file.filename}"`)
                setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
                setResponseHeader(event, 'X-Export-Row-Count', String(file.rowCount))
                return file.csv
            } catch (error) {
                return apiErrorResponse(event, error)
            }
        }),
    }
}
