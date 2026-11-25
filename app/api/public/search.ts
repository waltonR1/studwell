// 读取公开搜索清单和索引，解析、缓存及版本校验由搜索加载层负责。
import type {ContentLocale} from '~/types/public/runtime/content'

export function fetchSearchManifest(signal: AbortSignal) {
    return $fetch<unknown>('/search/manifest.json', {signal, cache: 'no-store'})
}

export function fetchSearchIndex(locale: ContentLocale, version: string, signal: AbortSignal) {
    return $fetch<unknown>(`/search/${locale}.${version}.json`, {signal})
}
