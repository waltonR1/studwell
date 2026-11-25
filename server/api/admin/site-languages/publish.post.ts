// 管理端 POST /api/admin/site-languages/publish 路由入口，衔接请求处理与业务服务。
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {authRuntime} from '../../../runtime/auth'
import {requestActor,authMeta} from '../../../http/auth'
import {publishSiteLanguages} from '../../../services/site-language-maintenance'
import {parseJsonBody} from '../../../http/validation'
import {siteLanguagePublishSchema} from '#shared/schemas/admin/site-languages'
export default defineApiHandler(async event=>{const runtime=authRuntime();const actor=await requestActor(event,runtime.service);return publishSiteLanguages(getDatabase(),actor,await parseJsonBody(event,siteLanguagePublishSchema),authMeta(event,runtime.options))})
