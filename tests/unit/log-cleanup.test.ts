import {describe, expect, it} from 'vitest'
import {logRetentionCutoff} from '../../server/policies/cleanup'

describe('日志保留期', () => {
  it('按北京时间自然日保留，截止边界不包含在删除范围内', () => {
    expect(logRetentionCutoff(new Date('2026-10-26T12:00:00Z'), 1).toISOString()).toBe('2026-10-25T16:00:00.000Z')
    expect(logRetentionCutoff(new Date('2026-10-26T12:00:00Z'), 2).toISOString()).toBe('2026-10-24T16:00:00.000Z')
    expect(logRetentionCutoff(new Date('2024-03-01T01:00:00Z'), 2).toISOString()).toBe('2024-02-28T16:00:00.000Z')
    for (const days of [0, -1, 1.1, 3651]) expect(() => logRetentionCutoff(new Date(), days)).toThrow()
  })
})
