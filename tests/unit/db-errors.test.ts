import { describe, expect, it } from 'vitest'
import { databaseConflictField, databaseConflictReason } from '../../server/core/db-errors'

function wrapped(code: string) {
  return new Error('wrapped', { cause: { code } })
}

describe('数据库写入冲突分类', () => {
  it('只有唯一键错误映射为 DUPLICATE', () => {
    expect(databaseConflictReason(wrapped('ER_DUP_ENTRY'))).toBe('DUPLICATE')
  })

  it('外键引用两侧错误映射为 REFERENCED', () => {
    expect(databaseConflictReason(wrapped('ER_ROW_IS_REFERENCED_2'))).toBe('REFERENCED')
    expect(databaseConflictReason(wrapped('ER_NO_REFERENCED_ROW_2'))).toBe('REFERENCED')
  })

  it('死锁与锁等待超时映射为可重试事务错误', () => {
    expect(databaseConflictReason(wrapped('ER_LOCK_DEADLOCK'))).toBe('RETRY')
    expect(databaseConflictReason(wrapped('ER_LOCK_WAIT_TIMEOUT'))).toBe('RETRY')
    expect(databaseConflictField('RETRY')).toBe('transaction')
  })

  it('未知错误与循环 cause 不再误分类', () => {
    expect(databaseConflictReason(wrapped('ER_UNKNOWN'))).toBeNull()
    const cyclic: { code?: string; cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(databaseConflictReason(cyclic)).toBeNull()
  })

  it('跳过未知包装代码，识别内层驱动冲突，外层已知分类优先', () => {
    expect(databaseConflictReason({code: 'QUERY_FAILED', cause: wrapped('ER_DUP_ENTRY')})).toBe('DUPLICATE')
    expect(databaseConflictReason({code: 'ER_LOCK_DEADLOCK', cause: wrapped('ER_DUP_ENTRY')})).toBe('RETRY')
    expect(databaseConflictReason({code: 'toString'})).toBeNull()
  })

  it('多节点循环 cause 有界结束，也能识别循环中的已知错误', () => {
    const first: {code: string; cause?: unknown} = {code: 'QUERY_FAILED'}
    const second: {code: string; cause?: unknown} = {code: 'UNKNOWN', cause: first}
    first.cause = second
    expect(databaseConflictReason(first)).toBeNull()
    second.code = 'ER_DUP_ENTRY'
    expect(databaseConflictReason(first)).toBe('DUPLICATE')
  })
})
