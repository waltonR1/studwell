import { describe, expect, it } from 'vitest'
import { logFilterSchema, logExportSchema } from '../../shared/schemas/admin/logs'
import { logExportContextSchema } from '../../server/schemas/log-context'
import { logDateRange, formatLogTime } from '../../server/policies/log-time'
import { csvCell, logCsv } from '../../server/services/logs/csv'
describe('日志日期、合同与CSV', () => {
  it('精确编号筛选保留大整数精度并进入导出审计上下文', () => {
    const filters = {requestId: 'e248c9d2-d617-40ae-9585-99026ba1846f', logId: '2026103001000000001'}
    expect(logFilterSchema.parse(filters)).toMatchObject(filters)
    expect(logExportSchema.parse(filters)).toMatchObject(filters)
    expect(logExportContextSchema.parse({version: 1, kind: 'audit', start: '2026-10-30T00:00:00.000Z', endExclusive: '2026-10-31T00:00:00.000Z', filters, rowCount: 1, includeSources: false}).filters).toEqual(filters)
    for (const value of [{requestId: 'invalid'}, {logId: '18446744073709551616'}, {logId: '1 OR 1=1'}]) expect(logFilterSchema.safeParse(value).success).toBe(false)
  })
  it('北京时间预设范围包含今天，午夜边界不随主机时区变化', () => {
    const now = new Date('2026-10-21T16:00:00.001Z')
    expect(logDateRange(logFilterSchema.parse({}), now)).toEqual({ start: new Date('2026-10-15T16:00:00Z'), end: new Date('2026-10-22T16:00:00Z') })
    expect(logDateRange(logFilterSchema.parse({ period: 'today' }), now)).toEqual({ start: new Date('2026-10-21T16:00:00Z'), end: new Date('2026-10-22T16:00:00Z') })
    expect(formatLogTime('2026-10-21T16:00:00Z')).toBe('2026-10-22 00:00:00 +08:00')
  })
  it('完整自定义日期左闭右开，验证闰年与跨年', () => {
    const filter = logFilterSchema.parse({ period: 'custom', startDate: '2024-02-29', endDate: '2024-03-01' })
    expect(logDateRange(filter, new Date())).toEqual({ start: new Date('2024-02-28T16:00:00Z'), end: new Date('2024-03-01T16:00:00Z') })
    for (const value of [{ period: 'custom' }, { period: 'custom', startDate: '2023-02-29', endDate: '2023-03-01' }, { period: 'custom', startDate: '2026-10-22', endDate: '2026-10-21' }, { period: '7d', startDate: '2026-10-22' }]) expect(logFilterSchema.safeParse(value).success).toBe(false)
  })
  it('严格筛选及导出合同拒绝数组、任意列、分页注入与伪造上下文', () => {
    for (const value of [{ account: ['root'] }, { actorId: '18446744073709551616' }, { ip: 'untrusted.example' }, { sort: 'arbitrary' }, { result: 'anything' }]) expect(logFilterSchema.safeParse(value).success).toBe(false)
    for (const value of [{ page: 1 }, { pageSize: 50 }, { includeSources: 'true' }, { columns: ['password'] }]) expect(logExportSchema.safeParse(value).success).toBe(false)
    expect(logExportContextSchema.safeParse({ arbitrary: { password: 'hidden' } }).success).toBe(false)
  })
  it('CSV防公式/控制字符、引号及大ID精度损失，保持标准数据表', () => {
    for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@command', '  =cmd', '\t=cmd', '\r@cmd', '\uFEFF=cmd', '\u0000=cmd']) expect(csvCell(value)).toMatch(/^"'/)
    expect(csvCell('a,"b"\r\nc')).toBe('"a,""b""\r\nc"')
    expect(csvCell('18446744073709551615')).toBe('"\'18446744073709551615"')
    const empty = logCsv([], false); expect(empty.startsWith('\uFEFF"ID"')).toBe(true); expect(empty.split('\r\n')).toHaveLength(2); expect(empty).not.toContain('可信IP')
  })
})
