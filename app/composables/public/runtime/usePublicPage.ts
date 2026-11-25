// 建立页面与区块实例上下文，供子组件读取发布内容、文案和媒体。
import type {InjectionKey, MaybeRefOrGetter} from 'vue'
import type {PublicPage, PublicSection} from '#shared/types/public/website'
import {usePageContent} from './usePageContent'
import {publicImage} from '~/utils/public/runtime/pageMedia'
import type {DisplayImage} from '~/types/public/runtime/media'

const pageKey: InjectionKey<ReturnType<typeof createPageContext>> = Symbol('published-page')
const sectionKey: InjectionKey<MaybeRefOrGetter<string>> = Symbol('published-section')

function createPageContext(key: string) {
  const content = usePageContent(key)
  const sections = computed(() => content.snapshot.value?.structure.sections.flatMap(meta => {
    const body = content.snapshot.value?.page.sections.find(section => section.id === meta.id)
    return body ? [{...meta, ...body}] : []
  }) ?? [])
  const section = (template: string) => {
    return sections.value.find(section => section.templateKey === template)
  }
  return {...content, key, sections, section, hasSection: (template: string) => !!section(template)}
}

// 页面只取一个同版快照；所有子组件从注入上下文读取，避免各区块独立请求。
export function usePublicPage(key: string) {
  const context = createPageContext(key)
  provide(pageKey, context)
  return context
}

export function useCurrentPublicPage(){return inject(pageKey,undefined)}

export function usePublicPageContext(key: string) {
  const context = inject(pageKey, undefined)
  return context?.key === key ? context : undefined
}

export function providePublicSection(id: MaybeRefOrGetter<string>) {provide(sectionKey, id)}

// 区块内部定义自己的数据类型，通过渲染器注入的实例 ID 读取内容。
export function usePublishedSection<Data = unknown>() {
  const context = inject(pageKey)
  const identity = inject(sectionKey)
  if (!context || !identity) throw new Error('Published section requires a section context')
  const section = computed(() => context.sections.value.find(entry => entry.id === toValue(identity)))
  const nextSection = computed(() => {
    const current = section.value
    if (!current) return
    const siblings = context.sections.value
    const index = siblings.findIndex(entry => entry.id === current.id)
    if (index < 0) return
    return siblings[index+1]
  })
  const pageLabel = computed(()=>context.snapshot.value?.structure.displayName??'')
  const media = (slot: string, alt = ''): DisplayImage => {
    const reference = section.value?.shared.media.find(media => media.key === slot)
    const page = context.snapshot.value?.page
    if (!reference || !page) throw createError({statusCode: 500, statusMessage: 'Published media is unavailable'})
    return publicImage(reference, page.media, alt)!
  }
  const data = computed(() => {
    const page = context.snapshot.value?.page
    return resolveSectionMedia(section.value?.content.data ?? {}, page?.media ?? {}) as Data
  })
  const t = (key: string, values: Record<string, string | number> = {}) => {
    const value = key.split('.').reduce<unknown>((value, part) =>
      value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined, section.value?.content.copy)
    if (typeof value !== 'string') throw createError({statusCode: 500, statusMessage: 'Published copy is unavailable'})
    return value.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match))
  }
  return {section, nextSection, data, media, t, pageLabel,  snapshot: context.snapshot}
}

// 字段定义已经由服务端校验；这里只把媒体引用适配成既有组件的输入。
export function resolveSectionMedia(value: unknown, media: PublicPage['media']): unknown {
  if (Array.isArray(value)) return value.map(item => resolveSectionMedia(item, media))
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  if ('mediaId' in object) {
    const reference = object as unknown as PublicSection['shared']['media'][number]
    if (!reference.mediaId) return null
    if (media[reference.mediaId]?.kind === 'video') return media[reference.mediaId]!.src
    return publicImage(reference, media)!
  }
  if (object.src && typeof object.src === 'object' && 'mediaId' in object.src) {
    const reference = object.src as PublicSection['shared']['media'][number]
    if (!reference.mediaId) return null
    const asset = media[reference.mediaId]
    if (!asset) throw createError({statusCode: 500, statusMessage: 'Published media is unavailable'})
    if (asset.kind === 'image') return publicImage(reference, media, typeof object.alt === 'string' ? object.alt : '')
    return {...object, src: asset.src, ...(object.poster ? {poster: resolveSectionMedia(object.poster, media)} : {})}
  }
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => [key, resolveSectionMedia(entry, media)]))
}
