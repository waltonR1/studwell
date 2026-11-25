import {computed, reactive, ref, watch} from 'vue'
import {defineStore} from 'pinia'
import {createCareersApi} from '~/api/admin/careers'
import {useAdminRequestStore} from './request'
import {useAdminSessionStore} from './session'
import {
  careerLocales,
  type AdminCareerPosition,
  type CareerContent,
  type CareerPositionQuery,
  type CareerTranslation,
} from '#shared/schemas/admin/careers'
import type {PageData} from '#shared/types/api'
import type {AdminOperationResult} from '~/types/admin/action-result'

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const blankTranslation = (): CareerTranslation => ({
  title: '',
  department: '',
  location: '',
  responsibilities: [],
  requirements: [],
})
const blankContent = (sortOrder: number): CareerContent => ({
  sortOrder,
  localized: Object.fromEntries(careerLocales.map(locale => [locale, blankTranslation()])) as CareerContent['localized'],
})

export const useAdminCareersStore = defineStore('admin-careers', () => {
  const request = useAdminRequestStore()
  const session = useAdminSessionStore()
  const api = createCareersApi(request)
  const list = reactive({
    data: null as PageData<AdminCareerPosition> | null,
    pending: false,
    error: '',
    stale: true,
    query: {} as CareerPositionQuery,
    warning: '',
  })
  const draft = ref<AdminCareerPosition | null>(null)
  const busy = ref(false)
  const saveError = ref('')
  const original = ref('')
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== original.value)
  const items = computed(() => list.data?.items ?? [])
  const total = computed(() => list.data?.total ?? 0)
  let listPromise: Promise<void> | undefined
  let listSequence = 0
  let writeEpoch = 0

  async function loadList(query: CareerPositionQuery, options: {force?: boolean} = {}) {
    const sameQuery = JSON.stringify(list.query) === JSON.stringify(query)
    if (listPromise && !options.force && sameQuery) return listPromise
    const sequence = ++listSequence
    const generation = session.generation
    const epoch = writeEpoch
    list.query = {...query}
    list.pending = true
    list.error = ''
    list.warning = ''
    listPromise = (async () => {
      try {
        const result = await api.list(query)
        if (sequence === listSequence && generation === session.generation && epoch === writeEpoch) {
          list.data = result
          list.stale = false
        }
      } catch (cause) {
        if (sequence === listSequence && generation === session.generation && epoch === writeEpoch) {
          list.error = request.message(cause)
        }
      } finally {
        if (sequence === listSequence && generation === session.generation && epoch === writeEpoch) {
          list.pending = false
        }
        if (sequence === listSequence) listPromise = undefined
      }
    })()
    return listPromise
  }

  async function enterList(query: CareerPositionQuery) {
    const sameQuery = JSON.stringify(list.query) === JSON.stringify(query)
    if (list.pending && sameQuery) return listPromise
    if (!list.data || list.stale || !sameQuery) await loadList(query, {force: list.pending})
  }

  function leaveList() {
    listSequence++
    listPromise = undefined
    list.pending = false
    list.stale = true
    list.warning = ''
    draft.value = null
    saveError.value = ''
  }

  async function refreshList() {
    await loadList({...list.query}, {force: true})
    if (list.error) throw new Error(list.error)
  }

  function setDraft(next: AdminCareerPosition | null) {
    draft.value = next ? copy(next) : null
    original.value = next ? JSON.stringify(next) : ''
  }

  function edit(item?: AdminCareerPosition) {
    if (busy.value) return
    saveError.value = ''
    setDraft(item
      ? copy(item)
      : {
          id: '',
          version: 1,
          content: blankContent(Math.min(1_000_000, (items.value.at(-1)?.content.sortOrder ?? 0) + 10)),
          publishedReleaseId: null,
          changed: true,
        })
  }

  function close() {
    if (busy.value) return
    setDraft(null)
    saveError.value = ''
  }

  async function mutate(
    work: () => Promise<AdminCareerPosition>,
    message: string,
    errorDelivery: 'form' | 'toast' = 'form',
  ): Promise<AdminOperationResult | null> {
    if (busy.value) return null
    const generation = session.generation
    const epoch = writeEpoch
    busy.value = true
    saveError.value = ''
    try {
      await work()
      if (generation !== session.generation || epoch !== writeEpoch) return null
      setDraft(null)
      await loadList({...list.query}, {force: true})
      if (generation !== session.generation || epoch !== writeEpoch) return null
      if (list.error) {
        list.warning = `操作已完成，但列表刷新失败：${list.error}`
        list.error = ''
        return {message: list.warning, status: 'warning'}
      }
      return {message, status: 'success'}
    } catch (cause) {
      if (generation === session.generation && epoch === writeEpoch) {
        const errorMessage = request.operationMessage(cause)
        if (errorDelivery === 'toast') return errorMessage ? {message: errorMessage, status: 'error'} : null
        saveError.value = errorMessage
      }
      return null
    } finally {
      if (generation === session.generation && epoch === writeEpoch) busy.value = false
    }
  }

  function normalizedContent(position: AdminCareerPosition): CareerContent {
    const content = copy(position.content)
    for (const entry of Object.values(content.localized)) {
      entry.responsibilities = entry.responsibilities.map(value => value.trim()).filter(Boolean)
      entry.requirements = entry.requirements.map(value => value.trim()).filter(Boolean)
    }
    return content
  }

  function save() {
    const position = draft.value
    if (!position || !session.can('content.careers.update')) return null
    return mutate(
      () => api.save(position, normalizedContent(position)),
      '岗位草稿已保存。',
    )
  }

  function changeState(position: AdminCareerPosition, action: 'publish' | 'withdraw') {
    if (!position.id || !session.can('content.careers.publish')) return null
    if ((action === 'publish' && !position.changed) || (action === 'withdraw' && !position.publishedReleaseId)) return null
    return mutate(
      () => api.action(position, action),
      action === 'publish' ? '岗位已发布。' : '岗位已下线。',
      'toast',
    )
  }

  function move(position: AdminCareerPosition, neighbor: AdminCareerPosition, direction: 'up' | 'down') {
    if (busy.value || list.pending || !session.can('content.careers.update')) return null
    return mutate(
      () => api.move(position, neighbor, direction),
      '岗位顺序已调整。',
      'toast',
    )
  }

  function resetForIdentityChange() {
    writeEpoch++
    listSequence++
    listPromise = undefined
    Object.assign(list, {
      data: null,
      pending: false,
      error: '',
      stale: true,
      query: {},
      warning: '',
    })
    draft.value = null
    busy.value = false
    saveError.value = original.value = ''
  }

  watch(() => session.generation, resetForIdentityChange)

  return {
    list,
    items,
    total,
    draft,
    busy,
    saveError,
    dirty,
    loadList,
    enterList,
    leaveList,
    refreshList,
    edit,
    close,
    save,
    changeState,
    move,
  }
})
