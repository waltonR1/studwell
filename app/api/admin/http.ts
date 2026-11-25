// 同源 HTTP 传输与返回合同；不读取 store，不处理导航、身份状态或 DOM。
import type {AdminSessionState} from '#shared/types/admin/auth'
import type {ApiSuccess} from '#shared/types/api'
import type {AdminCsvFile} from '~/types/admin/api'
import {ApiTransportError} from '~/utils/api-diagnostics'
import {adminApiConfig} from '~/config/admin/api'
import {createAdminApiDebug} from './request-debug'

export function createAdminHttpApi() {
    const request = useRequestFetch()
    const responseCookies = import.meta.server ? useResponseHeader('set-cookie') : undefined
    const trace = createAdminApiDebug(adminApiConfig.debug, import.meta.server ? 'server' : 'client')
    return {
        read<T>(path: string, query?: Record<string, string | number | undefined>) {
            return trace(path, 'GET', async observe => (await request<ApiSuccess<T>>('/api/admin/' + path, {
                query, onResponse: ({response}) => observe(response),
            })).data)
        },
        session() {
            return trace('auth/session', 'GET', async observe => (await request<ApiSuccess<AdminSessionState>>('/api/admin/auth/session', {
                onResponse({response}) {
                    observe(response)
                    if (import.meta.server) {
                        const cookies = response.headers.getSetCookie()
                        if (cookies.length) responseCookies!.value = cookies
                    }
                },
            })).data)
        },
        auth(path: 'login' | 'password' | 'logout', body: object | undefined, csrfToken: string) {
            return trace('auth/' + path, 'POST', async observe => {
                await $fetch('/api/admin/auth/' + path, {method: 'POST', body, headers: {'X-CSRF-Token': csrfToken},
                    onResponse: ({response}) => observe(response)})
            })
        },
        mutate<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body: object, csrfToken: string) {
            return trace(path, method, async observe => (await $fetch<ApiSuccess<T>>('/api/admin/' + path, {
                method, body, headers: {'X-CSRF-Token': csrfToken}, onResponse: ({response}) => observe(response),
            })).data)
        },
        upload<T>(path: string, file: File, csrfToken: string, query?: Record<string, string>, progress?: (value: number) => void): Promise<T> {
            return trace(path, 'POST', async observe => {
                if (!progress) return (await $fetch<ApiSuccess<T>>('/api/admin/' + path, {method: 'POST', query, body: file,
                    headers: {'X-CSRF-Token': csrfToken, 'Content-Type': file.type}, onResponse: ({response}) => observe(response)})).data
                return new Promise<T>((resolve, reject) => {
                    const xhr = new XMLHttpRequest(), params = new URLSearchParams(query)
                    xhr.open('POST', '/api/admin/' + path + '?' + params)
                    xhr.setRequestHeader('X-CSRF-Token', csrfToken)
                    xhr.setRequestHeader('Content-Type', file.type)
                    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
                    xhr.onerror = () => reject(new ApiTransportError('NETWORK_ERROR', '上传网络失败'))
                    xhr.onabort = () => reject(new ApiTransportError('ABORTED', '上传已取消'))
                    xhr.ontimeout = () => reject(new ApiTransportError('TIMEOUT', '上传超时'))
                    xhr.onload = () => {
                        const headers = new Headers()
                        const requestId = xhr.getResponseHeader('X-Request-ID')
                        if (requestId) headers.set('X-Request-ID', requestId)
                        observe({status: xhr.status, headers})
                        let body
                        try { body = JSON.parse(xhr.responseText) } catch { reject(new ApiTransportError('INVALID_RESPONSE', '上传响应无效')); return }
                        observe({status: xhr.status, headers, _data: body})
                        if (xhr.status >= 200 && xhr.status < 300 && body?.success) resolve(body.data)
                        else reject({statusCode: xhr.status, data: body})
                    }
                    xhr.send(file)
                })
            })
        },
        download(path: string, body: object, csrfToken: string): Promise<AdminCsvFile> {
            return trace(path, 'POST', async observe => {
                const response = await $fetch.raw<Blob>('/api/admin/' + path, {
                    method: 'POST', body, responseType: 'blob', headers: {'X-CSRF-Token': csrfToken},
                    onResponse: ({response}) => observe(response),
                })
                observe(response)
                const filename = response.headers.get('content-disposition')?.match(/filename="([a-z0-9_.-]+)"/i)?.[1]
                if (!filename || !response._data || !response.headers.get('content-type')?.startsWith('text/csv'))
                    throw new ApiTransportError('INVALID_RESPONSE', 'CSV响应无效')
                return {blob: response._data, filename, count: Number(response.headers.get('x-export-row-count') ?? 0)}
            })
        },
    }
}
