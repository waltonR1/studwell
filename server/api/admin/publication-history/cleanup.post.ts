// 显式清理一条历史发布；认证与输入边界在 HTTP 层，事务规则在服务层。
import {getDatabase} from '#server/db'
import {authRuntime} from '../../../runtime/auth'
import {requestActor,authMeta} from '../../../http/auth'
import {defineApiHandler} from '../../../http/handler'
import {parseJsonBody} from '../../../http/validation'
import {publicationHistoryCleanupSchema} from '#shared/schemas/admin/publication-history'
import {cleanupPublicationHistory} from '../../../services/publication-history'
export default defineApiHandler(async event=>{
 const runtime=authRuntime(),actor=await requestActor(event,runtime.service)
 return cleanupPublicationHistory(getDatabase(),actor,await parseJsonBody(event,publicationHistoryCleanupSchema),authMeta(event,runtime.options))
})
