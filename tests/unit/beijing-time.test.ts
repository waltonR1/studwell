import { describe, expect, it } from 'vitest'
import { formatBeijingTime, formatBeijingDateRange } from '../../shared/utils/beijing-time'

describe('后台北京时间格式', () => {
  it('跨日转换不依赖运行主机时区，按场景输出精度及导出时区', () => {
    expect(formatBeijingTime('2026-10-21T16:00:00Z')).toBe('2026-10-22 00:00:00')
    expect(formatBeijingTime(new Date('2026-10-21T15:59:59.999Z'))).toBe('2026-10-21 23:59:59')
    expect(formatBeijingTime('2026-10-21T16:00:25Z', 'minute')).toBe('2026-10-22 00:00')
    expect(formatBeijingTime('2026-10-21T16:00:25Z', 'offset')).toBe('2026-10-22 00:00:25 +08:00')
    expect(formatBeijingDateRange('2026-10-19T16:00:00Z', '2026-10-26T16:00:00Z')).toBe('2026-10-20 至 2026-10-26（含）')
  })

  it('空值与无效时间不抛错，统一显示占位符', () => {
    for (const value of [null, undefined, '', 'not-a-time']) expect(formatBeijingTime(value)).toBe('—')
  })
})
