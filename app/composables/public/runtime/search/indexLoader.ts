// 加载搜索索引，供公开端搜索逻辑使用。
import {siteLanguagesSchema} from '#shared/schemas/site-languages'
import type { ContentLocale } from '~/types/public/runtime/content'
import {searchCacheNamespace,searchSchemaVersion} from '#shared/config/website/search'
import {type SearchIndex,type SearchManifest} from '#shared/types/search'
import {validateIndex} from '~/utils/public/runtime/search/engine'
import {fetchSearchIndex,fetchSearchManifest} from '~/api/public/search'

const memory = new Map<ContentLocale, SearchIndex>()
const storageKey = (locale: ContentLocale) => `${searchCacheNamespace}:${locale}`

export function isManifest(value: unknown): value is SearchManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<SearchManifest>
  if(!Number.isInteger(manifest.modulePolicyVersion)||!manifest.modules||typeof manifest.modules.news!=='boolean'||typeof manifest.modules.careers!=='boolean')return false
  if(!(manifest.languageReleaseId===null||typeof manifest.languageReleaseId==='string'&&/^[1-9]\d{18}$/.test(manifest.languageReleaseId)))return false
  const versions = manifest.versions
  if (!(manifest.configReleaseId===null||typeof manifest.configReleaseId==='string'&&/^[1-9]\d{18}$/.test(manifest.configReleaseId)) || manifest.schemaVersion !== searchSchemaVersion || !versions || typeof versions !== 'object') return false
  const languages=siteLanguagesSchema.safeParse(manifest.languages)
  return languages.success&&Object.keys(versions).length===languages.data.enabledLocales.length&&languages.data.enabledLocales.every(locale => typeof versions[locale] === 'string' && /^[a-f0-9]{16}$/.test(versions[locale]!))
}

function readCached(locale: ContentLocale, version: string): SearchIndex | undefined {
  const current = memory.get(locale)
  if (current?.version === version) return current
  try {
    const stored = localStorage.getItem(storageKey(locale))
    const data: unknown = stored ? JSON.parse(stored) : undefined
    if (validateIndex(data, locale) && data.version === version) {
      memory.set(locale, data)
      return data
    }
  } catch {
    // 存储不可用或缓存损坏时，继续通过网络加载。
  }
}

function writeCached(locale: ContentLocale, index: SearchIndex) {
  memory.set(locale, index)
  try {
    localStorage.setItem(storageKey(locale), JSON.stringify(index))
  } catch {
    // 本地容量不足不影响当前搜索，当前会话仍可复用内存数据。
  }
}

// 仅在浏览器进入搜索页或切换语言时调用；先查版本，再决定是否下载完整索引。
export async function loadSearchIndex(locale: ContentLocale, signal: AbortSignal): Promise<SearchIndex> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const manifest: unknown = await fetchSearchManifest(signal)
    signal.throwIfAborted()
    if (!isManifest(manifest)) throw new Error('Invalid search manifest')
    const version = manifest.versions[locale]
    if(!version)throw new Error('Search locale is disabled')
    const cached = readCached(locale, version)
    if (cached) return cached

    const index: unknown = await fetchSearchIndex(locale,version,signal)
    signal.throwIfAborted()
    if (!validateIndex(index, locale)) throw new Error('Invalid search index')
    // 文件与清单不一致时重新检查清单一次。
    if (index.version !== version) continue
    writeCached(locale, index)
    return index
  }
  throw new Error('Search index version does not match manifest')
}
