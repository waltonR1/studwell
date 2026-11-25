// 服务端日志查询范围与 CSV 时间格式。
import type {LogFilter} from '#shared/schemas/admin/logs.ts'
import {beijingDate, formatBeijingTime} from '#shared/utils/beijing-time.ts'

const DAY = 86400000

export function logDateRange(filter: LogFilter, now: Date) {
    if (filter.period === 'custom') return {
        start: new Date(`${filter.startDate}T00:00:00+08:00`),
        end: new Date(new Date(`${filter.endDate}T00:00:00+08:00`).getTime() + DAY)
    }
    const midnight = new Date(`${beijingDate(now)}T00:00:00+08:00`).getTime(),
        days = filter.period === 'today' ? 1 : filter.period === '30d' ? 30 : 7
    return {start: new Date(midnight - (days - 1) * DAY), end: new Date(midnight + DAY)}
}

export function formatLogTime(value: string | Date | null | undefined) {
    return formatBeijingTime(value, 'offset')
}
