// 首页Section动画生命周期：统一初始化、重建、防抖与回收，各段自行创建自动播放时间轴。
import type { Ref } from 'vue'
import { loadGsapRuntime } from '~/utils/public/runtime/gsapRuntime'
import { measureHomeViewport } from '~/utils/public/sections/home/homeViewport'

type HomeMotionRuntime = Awaited<ReturnType<typeof loadGsapRuntime>>
type HomeMotionContext = HomeMotionRuntime & { el: HTMLElement; viewport: ReturnType<typeof measureHomeViewport> }
type HomeMotionSetup = (context: HomeMotionContext) => void | (() => void)
type HomeMotionLifecycleOptions = { enabled?: () => boolean; debounceMs?: number }

export function useHomeMotionLifecycle(root: Ref<HTMLElement | null>, createMotion: HomeMotionSetup, options: HomeMotionLifecycleOptions = {}) {
  const { locale } = useI18n()
  const enabled = options.enabled ?? (() => true)
  let cleanup: () => void = () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  let destroyed = false
  let revision = 0

  // 先清空回收入口，确保同一个实例不会被重复销毁。
  const dispose = () => {
    const previous = cleanup
    cleanup = () => {}
    previous()
  }
  const valid = (current: number) => !destroyed && current === revision && Boolean(root.value) && enabled()

  // nextTick确保翻译与DOM已更新；异步加载期间的旧请求不能覆盖新实例。
  const rebuild = async () => {
    const current = ++revision
    try {
      dispose()
      await nextTick()
      if (!valid(current)) return
      const runtime = await loadGsapRuntime()
      if (!valid(current)) return
      const el = root.value!
      const media = runtime.gsap.matchMedia()
      // 提前登记回收：创建动画中途失败也能撤销已写入样式和触发器。
      cleanup = () => media.revert()
      media.add('(prefers-reduced-motion: no-preference)', () => {
        const viewport = measureHomeViewport()
        // 导航与留白已占满视口时保持静态，不初始化不可见区域的动画。
        if (viewport.available <= 0) return
        return createMotion({ el, ...runtime, viewport })
      }, el)
    } catch {
      // 仅回收当前失败请求；过期的加载异常不能误删后来建立的动画。
      if (current === revision) dispose()
    }
  }

  // resize和字体就绪共用防抖；默认180ms，与各段原有重建节奏一致。
  const schedule = () => {
    if (destroyed) return
    clearTimeout(timer)
    timer = setTimeout(() => { timer = undefined; void rebuild() }, options.debounceMs ?? 180)
  }
  onMounted(() => {
    void rebuild()
    window.addEventListener('resize', schedule)
    if (document.fonts?.status !== 'loaded') {
      void document.fonts?.ready.then(() => { if (!destroyed) schedule() }).catch(() => {})
    }
  })

  // 更新翻译或启用状态前立即撤销旧动画，等待新DOM再测量，不残留旧动画样式。
  watch([locale, enabled], () => { revision++; dispose(); schedule() }, { flush: 'pre' })
  onBeforeUnmount(() => {
    destroyed = true
    revision++
    clearTimeout(timer)
    window.removeEventListener('resize', schedule)
    dispose()
  })
}
