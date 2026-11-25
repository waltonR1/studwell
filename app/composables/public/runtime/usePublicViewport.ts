// SSR 和水合首帧使用原有响应式桌面布局，挂载后统一选择展示端。
export function usePublicViewport() {
  const mobile = useState<boolean>('public-mobile-viewport', () => false)
  // 异步区块可能在 app:mounted 后才开始水合；每个入口均须先完成自己的桌面首帧。
  const mounted = ref(false)
  onMounted(() => { mounted.value = true })
  return computed(() => mounted.value && mobile.value)
}
