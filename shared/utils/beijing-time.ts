// 前后端共用的北京时间日期与显示格式工具，按 UTC+08:00 转换；不依赖后台业务或运行环境。
const BEIJING_OFFSET = 8 * 60 * 60 * 1000

export function beijingDate(now: Date) {
    return new Date(now.getTime() + BEIJING_OFFSET).toISOString().slice(0, 10)
}

export function formatBeijingTime(value: string | Date | null | undefined, format: 'minute' | 'second' | 'offset' = 'second') {
    if (value === null || value === undefined || value === '') return '—'
    const date = value instanceof Date ? value : new Date(value)
    if (!Number.isFinite(date.getTime())) return '—'
    const text = new Date(date.getTime() + BEIJING_OFFSET).toISOString().replace('T', ' ')
    return text.slice(0, format === 'minute' ? 16 : 19) + (format === 'offset' ? ' +08:00' : '')
}

// 查询范围内部使用半开区间，页面展示包含首尾的北京时间日期。
export function formatBeijingDateRange(start: string, endExclusive: string) {
    return `${beijingDate(new Date(start))} 至 ${beijingDate(new Date(new Date(endExclusive).getTime() - 1))}（含）`
}
