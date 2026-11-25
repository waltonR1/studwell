// 只提交历史清理请求；草稿和确认交互分别由 store、composable 管理。
import type {PublicationHistoryCleanup} from '#shared/schemas/admin/publication-history'
import type {AdminApiClient} from '~/types/admin/api'
export function createPublicationHistoryApi(api:AdminApiClient){return {
 cleanup:(body:PublicationHistoryCleanup)=>api.mutate<{deleted:true}>('publication-history/cleanup','POST',body),
}}
