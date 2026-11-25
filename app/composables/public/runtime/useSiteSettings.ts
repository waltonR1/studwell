// 加载并共享官网公开配置，同时支持预览上下文。
import {siteLanguagesSchema} from '#shared/schemas/site-languages'
import {inject,type InjectionKey} from 'vue'
import type {PublicSiteSettings} from '#shared/types/public/website'
import {usePublicSiteSettingsApi} from '~/api/public/site-settings'
import {resolveContentLocale} from '~/utils/public/runtime/locale'

export const sampleSiteSettingsKey:InjectionKey<PublicSiteSettings>=Symbol('template-sample-settings')
export function useSiteSettings() {
  const sample=inject(sampleSiteSettingsKey,undefined)
  if(sample)return {settings:shallowRef(sample),ready:Promise.resolve(),error:shallowRef(null),refresh:async()=>{}}
  const {locale} = useI18n()
  const language = computed(() => resolveContentLocale(locale.value))
  const request = usePublicSiteSettingsApi({
    key: computed(() => `public-site-settings:${language.value}`),
    query: computed(() => ({locale: language.value})),
    dedupe: 'defer',
    getCachedData: (key, app, {cause}) => cause === 'initial' ? app.payload.data[key] ?? app.static.data[key] : undefined,
  })
  const settings = computed(() => {
    const response = request.data.value
    if (response?.success && response.data.locale === language.value && siteLanguagesSchema.safeParse(response.data.languages).success) return response.data
    return null
  })
  const ready = request.then(() => {
    if (request.error.value) throw createError(request.error.value)
    if (!settings.value) throw createError({statusCode: 500, statusMessage: 'Site configuration is unavailable'})
  })
  // SEO/品牌等同步消费者不 await ready；初始化错误仍由布局 await 处理。
  void ready.catch(() => {})
  watch(request.error, error => { if (error) showError(error) })
  return {settings, ready, error: request.error, refresh: request.refresh}
}
