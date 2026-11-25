// 加载并缓存页面的发布快照，向页面提供同一版本的内容与结构。
import {inject,provide,shallowRef,type InjectionKey} from 'vue'
import type {WebsitePageView} from '#shared/types/public/website'
import type {PublicImageReference} from '#shared/types/public/website'
import {usePublicPageApi} from '~/api/public/pages'
import type {DisplayImage} from '~/types/public/runtime/media'
import {useSiteSettings} from './useSiteSettings'
import {resolveContentLocale} from '~/utils/public/runtime/locale'
import {publicImage} from '~/utils/public/runtime/pageMedia'

const previewKey: InjectionKey<WebsitePageView> = Symbol('website-draft-preview')
export function provideWebsitePreview(snapshot: WebsitePageView) { provide(previewKey, snapshot) }

// 配置与正文只交付同一发布版本，不回退到本地内容。
export function usePageContent(key: MaybeRefOrGetter<string>) {
  const preview = inject(previewKey, undefined)
  if (preview?.page.key === toValue(key)) return {
    snapshot: shallowRef(preview), ready: Promise.resolve(), refresh: async () => {}, error: shallowRef(null),
    image: (reference: PublicImageReference, alt = '') => publicImage(reference, preview.page.media, alt),
  }
  const {locale} = useI18n()
  const language = computed(() => resolveContentLocale(locale.value))
  const bootstrap = useSiteSettings()
  const request = usePublicPageApi(key, {
    key: computed(() => `public-page-content:${language.value}:${toValue(key)}`),
    query: computed(() => ({locale: language.value})), dedupe: 'defer',
    getCachedData: (key, app, {cause}) => cause === 'initial' ? app.payload.data[key] ?? app.static.data[key] : undefined,
  })
  const page = computed(() => {
    const response = request.data.value
    return response?.success && response.data.locale === language.value && response.data.key === toValue(key) ? response.data : null
  })
  const structure = computed(() => bootstrap.settings.value?.locale === language.value ? bootstrap.settings.value.pages[toValue(key)] ?? null : null)
  const snapshot = computed(() => page.value && structure.value && page.value.releaseId === structure.value.releaseId && page.value.configReleaseId === bootstrap.settings.value?.configReleaseId && page.value.languageReleaseId === bootstrap.settings.value?.languageReleaseId ? {page: page.value, structure: structure.value} : null)
  const assertResponse = () => {
    if (request.error.value) throw createError(request.error.value)
    if (!page.value) throw createError({statusCode: 500, statusMessage: 'Page content is unavailable'})
  }
  const refresh = async () => {
    await Promise.all([bootstrap.refresh(), request.refresh()])
    if (bootstrap.error.value) throw createError(bootstrap.error.value)
    assertResponse()
    if (!snapshot.value) throw createError({statusCode: 503, statusMessage: 'Published content is changing. Please retry.'})
  }
  const ready = Promise.all([bootstrap.ready, request]).then(async () => {
    assertResponse()
    if (!snapshot.value) await refresh()
  })
  void ready.catch(() => {})
  const image = (reference: PublicImageReference, alt: DisplayImage['alt'] = '') => {
    if (!snapshot.value) throw createError({statusCode: 503, statusMessage: 'Page content is not ready'})
    return publicImage(reference, snapshot.value.page.media, alt)
  }
  return {snapshot, ready, refresh, error: request.error, image}
}
