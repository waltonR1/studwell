import type {InquiryUpdate} from '#shared/schemas/admin/inquiries'
import type {InquiryDetailReadResponse, InquiryDetailResponse, InquiryInbox} from '#shared/types/admin/inquiry-responses'
import type {AdminApiClient} from '~/types/admin/api'

export function createInquiriesApi(api: AdminApiClient) {
    return {
        list: (query: Record<string, string | number | undefined>) => api.read<InquiryInbox>('inquiries', query),
        get: (id: string) => api.read<InquiryDetailReadResponse>('inquiries/' + id),
        update: (id: string, body: InquiryUpdate) => api.mutate<InquiryDetailResponse>('inquiries/' + id, 'PUT', body),
    }
}
