// 日志列表、详情及导出端点；不依赖状态容器或浏览器 DOM。
import type {AdminApiClient} from '~/types/admin/api'
import type {LogKind} from '#shared/types/admin/logs'
import type {LogRecord, LogList} from '#shared/types/admin/logs'
import type {LogFilter} from '#shared/schemas/admin/logs'

export function createLogsApi(api: AdminApiClient) {
    return {
        listLogs: (kind: LogKind, query: Record<string, string | number | undefined>) => api.read<LogList>(`logs/${kind}`, query),
        getLog: (kind: LogKind, id: string) => api.read<LogRecord>(`logs/${kind}/${id}`),
        exportLogs: (kind: LogKind, body: LogFilter & {includeSources: boolean}) => api.download(`logs/${kind}/export`, body),
    }
}
