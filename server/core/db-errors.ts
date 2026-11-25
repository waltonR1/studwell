// 识别数据库约束冲突及对应字段，供业务层转换错误。
import type {ApiConflictReason} from '#shared/types/api.ts'

const classifications: Record<string, ApiConflictReason> = {
    ER_DUP_ENTRY: 'DUPLICATE',
    ER_ROW_IS_REFERENCED_2: 'REFERENCED',
    ER_NO_REFERENCED_ROW_2: 'REFERENCED',
    ER_LOCK_DEADLOCK: 'RETRY',
    ER_LOCK_WAIT_TIMEOUT: 'RETRY',
}

export function databaseConflictReason(error: unknown): ApiConflictReason | null {
    const seen = new Set<object>()
    let current = error
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current)
        const candidate = current as {code?: unknown; cause?: unknown}
        // 未登记的包装代码不能遮住驱动错误；外层已登记分类优先。
        if (typeof candidate.code === 'string' && Object.hasOwn(classifications, candidate.code)) return classifications[candidate.code]!
        current = candidate.cause
    }
    return null
}

export function databaseConflictField(reason: ApiConflictReason) {
    if (reason === 'DUPLICATE') return 'unique'
    if (reason === 'REFERENCED') return 'references'
    if (reason === 'RETRY') return 'transaction'
    return 'version'
}
