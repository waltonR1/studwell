import type {AdminApiClient} from '~/types/admin/api'
import type {AdminCareerPosition, CareerContent, CareerPositionQuery} from '#shared/schemas/admin/careers'
import type {PageData} from '#shared/types/api'

const positionPath = (id?: string) => `careers/positions${id ? '/' + id : ''}`
const actionState = (position: AdminCareerPosition) => ({
  version: position.version,
  publishedReleaseId: position.publishedReleaseId,
})

export function createCareersApi(api: AdminApiClient) {
  return {
    list: (query: CareerPositionQuery) => api.read<PageData<AdminCareerPosition>>('careers/positions', {
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    }),
    save: (position: AdminCareerPosition, content: CareerContent) => api.mutate<AdminCareerPosition>(
      positionPath(position.id || undefined),
      position.id ? 'PUT' : 'POST',
      {content, ...(position.id ? {version: position.version} : {})},
    ),
    action: (position: AdminCareerPosition, action: 'publish' | 'withdraw') => api.mutate<AdminCareerPosition>(
      `${positionPath(position.id)}/${action}`,
      'POST',
      actionState(position),
    ),
    move: (position: AdminCareerPosition, neighbor: AdminCareerPosition, direction: 'up' | 'down') =>
      api.mutate<AdminCareerPosition>(`${positionPath(position.id)}/move`, 'POST', {
        version: position.version,
        neighborId: neighbor.id,
        neighborVersion: neighbor.version,
        direction,
      }),
  }
}
