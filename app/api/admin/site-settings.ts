import type {AdminApiClient} from '~/types/admin/api'
import type {SiteSettingsUpdate} from '#shared/schemas/admin/site-settings'
import type {SiteSettingsRecord} from '#shared/types/admin/site-settings'
export function createSiteSettingsApi(api: AdminApiClient) {
    return {
        read: () => api.read<SiteSettingsRecord>('site-settings'),
        update: (body: SiteSettingsUpdate) => api.mutate<SiteSettingsRecord>('site-settings', 'PUT', body),
    }
}
