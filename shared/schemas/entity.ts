// 实体 ID 与乐观锁写入合同；uint32 版本为下一次递增预留一个值。
import {z} from 'zod'
import {MAX_WRITABLE_ENTITY_VERSION} from '../config/entity-versions'

export const MAX_ENTITY_ID = 18446744073709551615n

export function isEntityIdInRange(value: string) {
    return /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= MAX_ENTITY_ID
}

export function createEntityIdSchema(message?: string) {
    return z.string().regex(/^[1-9]\d{0,19}$/).refine(isEntityIdInRange, message)
}

export const entityIdSchema = createEntityIdSchema()
export const entityVersionSchema = z.number().int().positive().max(MAX_WRITABLE_ENTITY_VERSION)
export const entityVersionBodySchema = z.strictObject({version: entityVersionSchema})
