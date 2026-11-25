// 统一公开 API 请求前缀和开发日志；缓存与业务校验由调用方负责。
import type {UseFetchOptions} from 'nuxt/app'
import {toValue, type MaybeRefOrGetter} from 'vue'
import type {ApiResponse} from '#shared/types/api'
import {createPublicApiDebugHooks} from './request-debug'

export type PublicFetchOptions<T> = Omit<UseFetchOptions<ApiResponse<T>>, 'onRequest' | 'onResponse' | 'onRequestError'>

export function usePublicApiFetch<T>(path: MaybeRefOrGetter<string>, options: PublicFetchOptions<T>) {
    const debug = import.meta.dev ? createPublicApiDebugHooks(import.meta.server ? 'server' : 'client') : {}
    return useFetch<ApiResponse<T>>(() => `/api/public/${toValue(path)}`, {...options, ...debug})
}
