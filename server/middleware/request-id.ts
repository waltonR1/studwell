// 仅覆盖新的公开/管理 API 分区，不改变官网 SSR 和资源响应。
import {defineEventHandler} from 'h3'
import {ensureRequestId, isManagedApiPath} from '../http/request-id'

export default defineEventHandler(event => {
    if (isManagedApiPath(event.path)) ensureRequestId(event)
})
