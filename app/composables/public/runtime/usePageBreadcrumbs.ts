import {toValue, type MaybeRefOrGetter} from 'vue'
import type {PublicPageStructure} from '#shared/types/public/website'
import {pageBreadcrumbs} from '~/utils/public/runtime/pageBreadcrumbs'
import {useSiteSettings} from './useSiteSettings'

export function usePageBreadcrumbs(
  page: MaybeRefOrGetter<PublicPageStructure | undefined>,
  fallbackTitle: MaybeRefOrGetter<string>,
) {
  const {settings} = useSiteSettings()
  const {t} = useI18n()
  return computed(() => pageBreadcrumbs(toValue(page), settings.value, t('nav.home'), toValue(fallbackTitle)))
}
