// 管理端 PUT /api/admin/site-languages 路由入口，衔接请求处理与业务服务。
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {authRuntime} from '../../../runtime/auth'
import {requestActor,authMeta} from '../../../http/auth'
import {saveSiteLanguageDraft} from '../../../services/site-language-maintenance'
import {parseJsonBody} from '../../../http/validation'
import {siteLanguageSaveSchema} from '#shared/schemas/admin/site-languages'
export default defineApiHandler(async event=>{const runtime=authRuntime();const actor=await requestActor(event,runtime.service);return saveSiteLanguageDraft(getDatabase(),actor,await parseJsonBody(event,siteLanguageSaveSchema),authMeta(event,runtime.options))})
