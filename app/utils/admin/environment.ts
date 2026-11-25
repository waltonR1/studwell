export function environmentBytes(bytes: number | null | undefined) {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    let value = Math.max(0, bytes), unit = 0
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
    return `${value.toLocaleString('zh-CN', {maximumFractionDigits: unit ? 2 : 0})} ${units[unit]}`
}

export function environmentDuration(seconds: number) {
    const minutes = Math.floor(Math.max(0, seconds) / 60), days = Math.floor(minutes / 1440)
    return `${days} 天 ${Math.floor(minutes / 60) % 24} 小时 ${minutes % 60} 分钟`
}
