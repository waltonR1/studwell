import type {InquirySettingsUpdate, InquirySettingsView} from '#shared/schemas/admin/inquiry-settings'
import type {AdminApiClient} from '~/types/admin/api'

export function createInquirySettingsApi(api: AdminApiClient) {
    return {
        get: () => api.read<InquirySettingsView>('inquiry-settings'),
        save: (body: InquirySettingsUpdate) => api.mutate<InquirySettingsView>('inquiry-settings', 'PUT', body),
    }
}
