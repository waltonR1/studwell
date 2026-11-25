// 后台审计变更摘要的类型，供服务端记录和管理端展示共用。
import type {logChangeFields, logChangeModes} from '../../config/admin/log-changes'

export type LogChangeField = keyof typeof logChangeFields

export interface LogChangeReference {
    id: string;
    name: string
}

export type LogChangeValue = string | number | boolean | null | LogChangeReference[]

export interface LogChangeContext {
    version: 1
    mode: keyof typeof logChangeModes
    fields: Array<{ field: LogChangeField; before: LogChangeValue; after: LogChangeValue }>
}
