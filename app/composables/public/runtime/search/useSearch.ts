// 搜索页状态以路由为准；索引只在客户端按语言加载，过期请求不能覆盖当前语言。
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import type {SearchIndex} from '#shared/types/search'
import { resolveContentLocale } from '~/utils/public/runtime/locale'
import { cleanQuery, parseSearchState, pageResults, queryError, searchDocuments, searchQuery, type SearchFilter } from '~/utils/public/runtime/search/engine'
import { loadSearchIndex } from './indexLoader'

export function useSearch() {
  const route = useRoute(), router = useRouter(), { locale } = useI18n()
  const {settings}=useSiteSettings()
  const state = computed(() => {
    const parsed=parseSearchState(route.query)
    return parsed.type==='news'&&settings.value?.modules?.news===false?{...parsed,type:'all' as const}:parsed
  })
  const draft = ref(state.value.q), localError = ref<string | null>(null)
  const error = computed(() => localError.value || queryError(state.value.q))
  const index = shallowRef<SearchIndex>(), status = ref<'loading' | 'ready' | 'failed'>('loading')
  const language = computed(() => resolveContentLocale(locale.value))
  let request = 0, controller: AbortController | undefined
  async function load() {
    const id = ++request, current = language.value
    controller?.abort(); controller = new AbortController()
    index.value = undefined; status.value = 'loading'
    try {
      const data = await loadSearchIndex(current, controller.signal)
      if (id !== request) return
      index.value = data; status.value = 'ready'
    } catch {
      if (id === request) status.value = 'failed'
    }
  }
  const results = computed(() => index.value && !error.value ? searchDocuments(index.value.documents.filter(doc=>doc.type!=='news'||settings.value?.modules?.news!==false), state.value.q) : [])
  const listing = computed(() => pageResults(results.value, state.value.type, state.value.page))
  function navigate(q: string, type: SearchFilter = 'all', page = 1) {
    return router.push({ path: route.path, query: searchQuery(q, type, page) })
  }
  function submit(value = draft.value) {
    const q = cleanQuery(value)
    localError.value = queryError(q)
    if (localError.value) return
    draft.value = q
    return navigate(q)
  }
  function clear() { localError.value = null; draft.value = ''; return navigate('') }
  // 输入修正后解除本地错误；列表继续对应 URL 中的已提交查询。
  watch(draft, () => { localError.value = null })
  watch(() => route.fullPath, () => { draft.value = state.value.q; localError.value = null })
  watch(language, () => { if (import.meta.client) void load() })
  // 等索引就绪才夹取最大页码；加载时不把直达第 2 页误改为第 1 页。
  watch([state, status, listing], () => {
    if (!import.meta.client || status.value !== 'ready') return
    // Nuxt 的页面路由在切换期间延后更新；旧页面不得规范化并覆盖正在进行的语言导航。
    if (router.currentRoute.value.fullPath !== route.fullPath || route.path.split('/')[1] !== language.value) return
    const canonical = searchQuery(state.value.q, state.value.type, listing.value.page)
    const keys = ['q', 'type', 'page']
    if (keys.some(key => route.query[key] !== canonical[key])) void router.replace({ path: route.path, query: canonical })
  })
  onMounted(load)
  onBeforeUnmount(() => { request++; controller?.abort() })
  return { state, draft, error, status, listing, submit, clear, retry: load, filter: (type: SearchFilter) => navigate(state.value.q, type), turnPage: (page: number) => navigate(state.value.q, state.value.type, page) }
}
