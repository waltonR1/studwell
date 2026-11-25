// 前端解析后的受控请求失败信息，原始接口合同继续引用 shared。
import type {ApiConflictReason} from '#shared/types/api'

export interface AdminRequestFailure {
    code: string
    message: string
    reason?: ApiConflictReason
    requestId?: string
    fields?: string[]
    status?: number
}

