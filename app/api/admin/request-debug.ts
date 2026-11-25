import {createApiDebug} from '~/utils/api-request-debug'

export function createAdminApiDebug(enabled: boolean, side: 'server' | 'client') {
    const trace = createApiDebug('Admin', enabled, side)
    return <T>(path: string, method: string, work: Parameters<typeof trace<T>>[2]) =>
        trace('/api/admin/' + path, method, work)
}
