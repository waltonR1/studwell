// 受控 API 错误码类型，由共享目录推导。
import type {apiErrorCodes} from '../config/api-errors'

export type ApiErrorCode = typeof apiErrorCodes[number]
