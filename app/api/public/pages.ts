// 按页面键读取已发布正文，版本一致性由页面加载层校验。
import {toValue, type MaybeRefOrGetter} from 'vue'
import type {PublicPage} from '#shared/types/public/website'
import {usePublicApiFetch, type PublicFetchOptions} from './http'

export function usePublicPageApi(key: MaybeRefOrGetter<string>, options: PublicFetchOptions<PublicPage>) {
    return usePublicApiFetch<PublicPage>(() => `pages/${encodeURIComponent(toValue(key))}`, options)
}
