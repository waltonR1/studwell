// 定时任务接口适配；会话、CSRF 和错误恢复统一复用后台请求入口。
import type {AdminApiClient} from '~/types/admin/api'
import type {
    TaskRecord,
    TaskRunRecord,
    TaskPreviewResponse
} from '#shared/types/admin/tasks'
import type {PageData} from '#shared/types/api'
import type {TaskUpdateInput, TaskStatusInput, TaskPreviewInput, TaskRunInput, TaskControlInput, TaskRunQueryInput} from '#shared/schemas/admin/tasks'

export function createTasksApi(api: AdminApiClient) {
    return {
        listTasks: () => api.read<TaskRecord[]>('tasks'),
        updateTask: (id: string, body: TaskUpdateInput) => api.mutate(`tasks/${id}`, 'PUT', body),
        changeTaskStatus: (id: string, body: TaskStatusInput) => api.mutate(`tasks/${id}/status`, 'PUT', body),
        previewSchedule: (body: TaskPreviewInput) => api.mutate<TaskPreviewResponse>('tasks/preview', 'POST', body),
        runTask: (id: string, version: TaskRunInput['version']) => api.mutate(`tasks/${id}/run`, 'POST', {version, confirmed: true} satisfies TaskRunInput),
        listTaskRuns: (id: string, query: TaskRunQueryInput) => api.read<PageData<TaskRunRecord>>(`tasks/${id}/runs`, query),
        getTaskRun: (id: string) => api.read<TaskRunRecord>(`task-runs/${id}`),
        controlTaskRun: (id: string, action: TaskControlInput['action']) => api.mutate(`task-runs/${id}/control`, 'POST', {
            action,
            confirmed: true
        } satisfies TaskControlInput),
    }
}
