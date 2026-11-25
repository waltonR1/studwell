// 加载首页推荐新闻并整理主推项和其余列表。
import {inject,type InjectionKey} from 'vue'
import {usePublicNewsListApi} from '~/api/public/news'
import {resolveContentLocale} from '~/utils/public/runtime/locale'

async function liveHomeNews() {

  const {locale} = useI18n()
  const request = await usePublicNewsListApi({
    query: computed(() => ({locale: resolveContentLocale(locale.value), featured: 'true', pageSize: '4'})),
  })
  const list = computed(() => request.data.value?.success ? request.data.value.data : null)
  // 首页装配由首页快照决定；新闻未发布或接口失败时不展示失效入口。
  return {available: computed(() => !!list.value), featured: computed(() => list.value?.items[0]),
    remaining: computed(() => list.value?.items.slice(1) ?? [])}
}

export const homeNewsSource:InjectionKey<typeof liveHomeNews>=Symbol('HomeNews')
export function useHomeNews(){return inject(homeNewsSource,liveHomeNews)()}
