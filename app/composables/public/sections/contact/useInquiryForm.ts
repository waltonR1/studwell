// 管理咨询表单的输入、校验、提交及结果状态。
import {inject,type InjectionKey} from 'vue'
import {inquiryEmail} from '#shared/schemas/public/inquiries'
import {submitPublicInquiryApi, usePublicInquiryCategoriesApi} from '~/api/public/inquiries'
import {resolveContentLocale} from '~/utils/public/runtime/locale'

async function liveInquiryForm() {
  const {locale} = useI18n()
  const contentLocale = computed(() => resolveContentLocale(locale.value))
  const request = await usePublicInquiryCategoriesApi({
    query: computed(() => ({locale: contentLocale.value})),
    retry: 0,
  })
  const categoryStatus = request.status
  const categories = computed(() => request.data.value?.success?request.data.value.data:[])
  const empty = () => ({category: '', name: '', email: '', company: '', country: '', message: ''})
  const fields = reactive(empty())
  const invalidEmail = ref(false)
  const pending = ref(false), reference = ref(''), submitError = ref<'failed' | 'rateLimited' | 'categoryChanged' | ''>('')
  let lastAttempt: {payload: string; key: string} | undefined

  async function submit() {
    if (pending.value || !fields.category || !categories.value.length) return
    reference.value = ''; submitError.value = ''
    invalidEmail.value = !inquiryEmail.safeParse(fields.email).success
    if (invalidEmail.value) return
    pending.value = true
    try {
      const payload = {...fields, locale: contentLocale.value}
      const serialized = JSON.stringify(payload)
      if (lastAttempt?.payload !== serialized) lastAttempt = {payload: serialized, key: crypto.randomUUID()}
      const result = await submitPublicInquiryApi({...payload, submissionKey: lastAttempt.key})
      if (!result.success) {
        if (result.error.fields?.some(field => field.path === 'category')) {
          fields.category = ''
          submitError.value = 'categoryChanged'
          await request.refresh()
        } else if (result.error.fields?.some(field => field.path === 'email')) {
          invalidEmail.value = true
        } else submitError.value = result.error.code === 'RATE_LIMITED' ? 'rateLimited' : 'failed'
        return
      }
      reference.value = result.data.id
      lastAttempt = undefined
      Object.assign(fields, empty())
    } catch {
      submitError.value = 'failed'
    } finally {
      pending.value = false
    }
  }

  return {fields, categories, categoryStatus, invalidEmail, pending, reference, error:submitError, submit}
}

export const inquiryFormSource:InjectionKey<typeof liveInquiryForm>=Symbol('inquiry-form-source')
export function useInquiryForm(){return inject(inquiryFormSource,liveInquiryForm)()}
