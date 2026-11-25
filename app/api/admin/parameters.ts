// 参数接口适配；组关联规则继续复用已有 shared 工具。
import type {AdminApiClient} from '~/types/admin/api'
import type {ParameterRecord} from '#shared/types/admin/parameters'
import type {ParameterUpdateInput, ParameterBatchInput} from '#shared/schemas/admin/parameters'

export function createParametersApi(api: AdminApiClient) {
    return {
        listParameters: () => api.read<ParameterRecord[]>('parameters'),
        updateParameter: (id: string, body: ParameterUpdateInput) => api.mutate(`parameters/${id}`, 'PUT', body),
        updateParameterBatch: (body: ParameterBatchInput) => api.mutate<ParameterRecord[]>('parameters/batch', 'PUT', body),
    }
}
