// 按当前语言、分类和页码加载新闻列表。
import {inject,type InjectionKey} from 'vue'
import type {MaybeRefOrGetter} from 'vue'
import {publicCodeSchema} from '#shared/schemas/public/queries'
import {usePublicNewsListApi} from '~/api/public/news'
import {resolveContentLocale} from '~/utils/public/runtime/locale'

async function liveNewsCatalog(pageSize: MaybeRefOrGetter<number>) {
  const route = useRoute()
  const {locale} = useI18n()
  const selectedCategory = computed(() => publicCodeSchema.safeParse(route.query.category).data)
  const page = computed(() => typeof route.query.page === 'string' && /^[1-9]\d{0,5}$/.test(route.query.page) && Number(route.query.page) <= 100000
    ? Number(route.query.page) : 1)

  const request = await usePublicNewsListApi({
    query: computed(() => ({locale: resolveContentLocale(locale.value), category: selectedCategory.value, page: String(page.value), pageSize: String(toValue(pageSize))})),
  })
  return {
    list: computed(() => request.data.value?.success ? request.data.value.data : null),
    error: request.error, pending: request.pending, selectedCategory, page,
  }
}

export const newsCatalogSource:InjectionKey<typeof liveNewsCatalog>=Symbol('NewsCatalog')
export function useNewsCatalog(pageSize: MaybeRefOrGetter<number>){return inject(newsCatalogSource,liveNewsCatalog)(pageSize)}
