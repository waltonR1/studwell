// 适配站点基础设置的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {getQuery,setResponseHeader} from 'h3'
import {publicLocalizedQuerySchema} from '#shared/schemas/public/queries'
import {z} from 'zod'
import type {Database} from '../../db/transaction'
import {createAuthService} from '../../services/auth'
import {createSiteSettingsService} from '../../services/site-settings'
import {defineApiHandler} from '../handler'
import {parseJsonBody} from '../validation'
import {parseInput} from '../../core/validation'
import {siteSettingsUpdateSchema} from '#shared/schemas/admin/site-settings'
import {authMeta, requestActor, type AuthHttpOptions} from '../auth'

const previewQuery=publicLocalizedQuerySchema.extend({section:z.enum(['header','footer']),mode:z.enum(['draft','published'])})

export function siteSettingsHandlers(db: Database, options: AuthHttpOptions) {
    const service = createSiteSettingsService(db), auth = createAuthService(db)
    return {
        read: defineApiHandler(async event => {
            const actor = await requestActor(event, auth)
            const query=getQuery(event)
            if(!Object.keys(query).length)return service.read(actor)
            const {locale,section,mode}=await parseInput(previewQuery,query)
            setResponseHeader(event,'Cache-Control','private, no-store')
            return service.preview(actor,{locale,section,mode})
        }),
        update: defineApiHandler(async event => service.update(await requestActor(event, auth), await parseJsonBody(event, siteSettingsUpdateSchema, 256 * 1024), authMeta(event, options))),
    }
}
