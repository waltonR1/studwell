// 加载当前语言的公开职位，提供列表及加载状态。
import {inject,type InjectionKey} from 'vue'
import {usePublicCareerPositionsApi} from '~/api/public/careers'
import {resolveContentLocale} from '~/utils/public/runtime/locale'

async function liveCareerPositions() {

  const {locale} = useI18n()
  const request = await usePublicCareerPositionsApi({
    query: computed(() => ({locale: resolveContentLocale(locale.value)})),
  })
  const positions = computed(() => request.data.value?.success ? request.data.value.data : [])
  const available = computed(() => request.data.value?.success === true)
  return {
    positions,
    available,
    error: request.error,
    pending: request.pending,
  }
}

export const careerPositionsSource:InjectionKey<typeof liveCareerPositions>=Symbol('CareerPositions')
export function useCareerPositions(){return inject(careerPositionsSource,liveCareerPositions)()}
