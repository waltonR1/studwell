import type {AdminApiClient} from '~/types/admin/api'
import type {EnvironmentData} from '#shared/types/admin/environment'

export function createEnvironmentApi(api: AdminApiClient) {
    return {getEnvironment: () => api.read<EnvironmentData>('environment')}
}
