// 字典类型和选项接口；保持二者共享服务端版本的原有协议。
import type {DictionaryCreateInput, DictionaryUpdateInput, DictionaryItemCreateInput, DictionaryItemUpdateInput} from '~/types/admin/api-inputs'
import type {AdminApiClient} from '~/types/admin/api'
import type {DictionaryRecord, DictionaryDetail} from '#shared/types/admin/dictionaries'
import type {PageData} from '#shared/types/api'

export function createDictionariesApi(api: AdminApiClient) {
    return {
        listDictionaries: (query: Record<string, string | number | undefined>) => api.read<PageData<DictionaryRecord>>('dictionaries', query),
        getDictionary: (id: string) => api.read<DictionaryDetail>(`dictionaries/${id}`),
        createDictionary: (body: DictionaryCreateInput) => api.mutate<DictionaryDetail>('dictionaries', 'POST', body),
        updateDictionary: (id: string, body: DictionaryUpdateInput) => api.mutate<DictionaryDetail>(`dictionaries/${id}`, 'PUT', body),
        createItem: (dictionaryId: string, body: DictionaryItemCreateInput) => api.mutate<DictionaryDetail>(`dictionaries/${dictionaryId}/items`, 'POST', body),
        updateItem: (id: string, body: DictionaryItemUpdateInput) => api.mutate<DictionaryDetail>(`dictionary-items/${id}`, 'PUT', body),
    }
}
