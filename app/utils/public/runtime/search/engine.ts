// 纯函数搜索：AND 召回、字段等级排序、URL 解析及安全文本高亮共用同一规范化规则。
import {searchCategories,searchFilters,searchSchemaVersion} from '#shared/config/website/search'
import {type SearchDocument,type SearchIndex,type SearchType} from '#shared/types/search'
export const SEARCH_TYPES = searchFilters
export type SearchFilter = typeof SEARCH_TYPES[number]
const PAGE_SIZE = 10
export const cleanQuery = (value: string) => value.trim().replace(/\s+/gu, ' ')
function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC').replace(/\s+/gu, ' ').trim()
}
const compactCode = (value: string) => value.replace(/[\s\-‐‑–—]/gu, '')
function queryTerms(query: string): string[] {
  // C 1157 / C-1157 视为一个型号片段，普通词之间仍要求 AND。
  const value = normalize(query).replace(/([a-z])[\s\-‐‑–—]+(?=\d)/gu, '$1')
  return [...new Set(value.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean))]
}
export function queryError(query: string): 'tooLong' | 'invalid' | null {
  if ([...query].length > 100) return 'tooLong'
  return query && !queryTerms(query).length ? 'invalid' : null
}

export function searchDocuments(documents: SearchDocument[], query: string): SearchDocument[] {
  if (!query || queryError(query)) return []
  const terms = queryTerms(query), full = normalize(query)
  const ranked = documents.flatMap(doc => {
    const title = normalize(doc.title), code = normalize(doc.code || '')
    const matches = (field: string, term: string) => field.includes(term)
    const inTitle = (term: string) => matches(title, term) || matches(code, term) || (/\p{L}.*\p{N}/u.test(term) && compactCode(code).includes(compactCode(term)))
    const categories = normalize([...doc.categoryPath, ...doc.aliases].join(' '))
    const summary = normalize(doc.summary), body = normalize(doc.body)
    const inCategories = (term: string) => categories.includes(term)
    const inSummary = (term: string) => summary.includes(term)
    if (!terms.every(term => inTitle(term) || inCategories(term) || inSummary(term) || body.includes(term))) return []
    const codeQuery = /\p{L}.*\p{N}/u.test(full) ? compactCode(full) : ''
    const exact = title === full || (!!code && (code === full || (!!codeQuery && compactCode(code) === codeQuery)))
    const contains = title.includes(full) || (!!code && (code.includes(full) || (!!codeQuery && compactCode(code).includes(codeQuery))))
    const level = exact ? 6 : contains ? 5 : terms.every(inTitle) ? 4 : terms.every(t => inTitle(t) || inCategories(t)) ? 3 : terms.every(t => inTitle(t) || inCategories(t) || inSummary(t)) ? 2 : 1
    return [{ doc, score: [level, terms.filter(inTitle).length, terms.filter(inCategories).length, terms.filter(inSummary).length] }]
  })
  const order=Object.fromEntries(searchCategories.map((type,index)=>[type,index])) as Record<SearchType,number>
  return ranked.sort((a, b) => {
    for (let i = 0; i < a.score.length; i++) { const difference = b.score[i]! - a.score[i]!; if (difference) return difference }
    return order[a.doc.type] - order[b.doc.type] || (b.doc.publishedAt || '').localeCompare(a.doc.publishedAt || '') || a.doc.id.localeCompare(b.doc.id)
  }).map(result => result.doc)
}

type QueryValue = string | null | (string | null)[] | undefined
const first = (value: QueryValue) => (Array.isArray(value) ? value[0] : value) || ''
export function parseSearchState(query: Record<string, QueryValue>) {
  const q = cleanQuery(first(query.q))
  const rawType = first(query.type)
  const type: SearchFilter = SEARCH_TYPES.includes(rawType as SearchFilter) ? rawType as SearchFilter : 'all'
  const rawPage = first(query.page)
  const page = /^[1-9]\d*$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) ? Number(rawPage) : 1
  return { q, type: q ? type : 'all' as SearchFilter, page: q ? page : 1 }
}
export function searchQuery(q: string, type: SearchFilter = 'all', page = 1): Record<string, string> {
  return q ? { q, ...(type !== 'all' ? { type } : {}), ...(page > 1 ? { page: String(page) } : {}) } : {}
}
export function pageResults(results: SearchDocument[], type: SearchFilter, requestedPage: number) {
  const counts={all:results.length,...Object.fromEntries(searchCategories.map(type=>[type,0]))} as Record<SearchFilter,number>
  for (const result of results) counts[result.type]++
  const filtered = type === 'all' ? results : results.filter(doc => doc.type === type)
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), page = Math.min(Math.max(1, requestedPage), pages)
  return { counts, total: filtered.length, pages, page, items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) }
}

// 规范化会改变字符长度；按字素记录原文区间，避免重音或代理对高亮错位。
function matchRanges(text: string, query: string): [number, number][] {
  let normalized = ''
  const map: [number, number][] = []
  for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
    const value = normalize(part.segment)
    // 单独的空格也需要占位，避免意外拼接相邻单词。
    const normalizedPart = value || (/\s/u.test(part.segment) ? ' ' : '')
    normalized += normalizedPart
    for (let i = 0; i < normalizedPart.length; i++) map.push([part.index, part.index + part.segment.length])
  }
  const ranges: [number, number][] = []
  for (const term of queryTerms(query)) {
    let offset = 0, index: number
    while ((index = normalized.indexOf(term, offset)) !== -1) {
      const start = map[index], end = map[index + term.length - 1]
      if (start && end) ranges.push([start[0], end[1]])
      offset = index + term.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  return ranges.reduce<[number, number][]>((merged, range) => {
    const last = merged.at(-1)
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
    return merged
  }, [])
}
export function highlight(text: string, query: string) {
  const segments: { text: string; hit: boolean }[] = []
  let offset = 0
  for (const [start, end] of matchRanges(text, query)) {
    if (start > offset) segments.push({ text: text.slice(offset, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true }); offset = end
  }
  if (offset < text.length) segments.push({ text: text.slice(offset), hit: false })
  return segments
}
export function excerpt(doc: SearchDocument, query: string): string {
  const source = matchRanges(doc.summary, query).length ? doc.summary : matchRanges(doc.body, query).length ? doc.body : doc.summary
  const hit = matchRanges(source, query)[0]?.[0] || 0
  const characters = [...source], hitIndex = [...source.slice(0, hit)].length
  const start = Math.max(0, hitIndex - 30), end = Math.min(characters.length, start + 120)
  return (start ? '…' : '') + characters.slice(start, end).join('') + (end < characters.length ? '…' : '')
}
export function validateIndex(value: unknown, locale: string): value is SearchIndex {
  if (!value || typeof value !== 'object') return false
  const index = value as SearchIndex
  if (index.schemaVersion !== searchSchemaVersion || index.locale !== locale || !/^[a-f0-9]{16}$/.test(index.version) || !Array.isArray(index.documents)) return false
  const ids = new Set(), paths = new Set()
  return index.documents.every(doc => {
    if (!doc || typeof doc.id !== 'string' || ids.has(doc.id) || typeof doc.path !== 'string' || paths.has(doc.path) || !/^\/(?!\/)[a-z0-9_/-]*$/.test(doc.path) || doc.locale !== locale || !searchCategories.includes(doc.type)) return false
    if (![doc.title, doc.summary, doc.body].every(v => typeof v === 'string') || !doc.title.trim() || (doc.code !== undefined && typeof doc.code !== 'string') || ![doc.categoryPath, doc.aliases].every(v => Array.isArray(v) && v.every(s => typeof s === 'string')) || (doc.publishedAt !== undefined && (typeof doc.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.publishedAt)))) return false
    ids.add(doc.id); paths.add(doc.path); return true
  })
}
