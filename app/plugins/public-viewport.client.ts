export default defineNuxtPlugin(nuxtApp => {
  const mobile = useState<boolean>('public-mobile-viewport', () => false)
  const query = window.matchMedia('(max-width: 767px)')
  const update = () => { mobile.value = query.matches }
  nuxtApp.hook('app:mounted', () => {
    update()
    query.addEventListener('change', update)
  })
  nuxtApp.vueApp.onUnmount(() => query.removeEventListener('change', update))
})
