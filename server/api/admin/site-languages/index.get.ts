// 管理端 GET /api/admin/site-languages 路由入口，衔接请求处理与业务服务。
import {getDatabase} from '#server/db'
import {defineApiHandler} from '../../../http/handler'
import {authRuntime} from '../../../runtime/auth'
import {requestActor} from '../../../http/auth'
import {readSiteLanguageState} from '../../../services/site-language-maintenance'

export default defineApiHandler(async event=>{const runtime=authRuntime();const actor=await requestActor(event,runtime.service);return readSiteLanguageState(getDatabase(),actor)})
