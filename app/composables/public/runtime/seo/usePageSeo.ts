// 按页面配置生成 SEO 信息、规范链接和语言替代链接。
import {useBrandIdentity} from '~/composables/public/runtime/useBrandIdentity'
import {usePublicSeo} from './usePublicSeo'
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
export function usePageSeo(key: MaybeRefOrGetter<string>, pageDescriptionKey?: string) {
  const brand=useBrandIdentity()
  const {t,locales} = useI18n()
  const {settings} = useSiteSettings()
  const pageKey = computed(() => pageDescriptionKey ? undefined : toValue(key))
  const localePath = useLocalePath()
  const origin = useRequestURL().origin
  if (!pageDescriptionKey) useHead(() => {
    const path = pageKey.value ? settings.value?.pages[pageKey.value]?.path : undefined
    return {link: path ? [
      {rel:'canonical',href:origin+localePath(path)},
      ...locales.value.filter(language=>settings.value?.languages.enabledLocales.includes(language.code)??false).map(language=>({rel:'alternate' as const,type:'text/html',hreflang:language.language??language.code,href:origin+localePath(path,language.code)})),
    ] : []}
  })
  const seo = computed(() => pageKey.value ? settings.value?.pages[pageKey.value]?.seo : undefined)
  if (settings.value && pageKey.value && !seo.value) throw createError({statusCode: 404, statusMessage: 'Page not found'})
  usePublicSeo(() => pageDescriptionKey ? {title:[t(toValue(key)),brand.value].filter(Boolean).join(' | '),description:t(pageDescriptionKey)} : seo.value)
}
