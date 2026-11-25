// 整屏场景控制：切屏完成才发布入场事件；长内容只在当前场景内滚动。
import { loadGsapRuntime } from '~/utils/public/runtime/gsapRuntime'
import { useBodyScrollLock } from '~/composables/public/runtime/useBodyScrollLock'
import {useSceneGate} from '~/composables/public/runtime/useSceneGate'

const sceneMotionConfig = {duration: .42, wheelThreshold: 28, wheelIdleMs: 100} as const

export function usePageScenes(root: Ref<HTMLElement | null>, options: {duration?: number; sceneMode?: boolean;headerHeight?:number} = {}) {
  const ready = ref(false)
  const locked = ref(false)
  useBodyScrollLock(locked)
  const pending = useSceneGate()
  const route=useRoute()
  const stateKey='scene-return-position:'+route.path
  // 仅在当前应用会话中保留；刷新或直接打开页面仍从首个场景开始。
  const returnPosition = useState<{ scene: string; scrollTop: number } | null>(stateKey, () => null)
  let savePosition = () => {}
  let navigateToScene: ((scene: string) => void) | undefined
  onBeforeRouteLeave(() => { savePosition() })
  let dispose = () => {}
  let destroyed = false
  onMounted(async () => {
    const { gsap } = await loadGsapRuntime()
    if (destroyed || !root.value) return
    const el = root.value
    const panels = Array.from(el.querySelectorAll<HTMLElement>('[data-page-scene]'))
    if (!panels.length) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    // 高度不足时退出固定分场，避免浏览器缩放后把首页切成多个内部滚动页。
    const sceneViewport = window.matchMedia('(min-height: 721px)')
    let sceneMode = options.sceneMode !== false && sceneViewport.matches
    const restoredIndex = panels.findIndex(panel => panel.dataset.pageScene === returnPosition.value?.scene)
    const restoring = restoredIndex >= 0
    let index = restoring ? restoredIndex : 0, switching = false, wheelTotal = 0, wheelDirection = 0
    let gestureLocked = false, interiorGesture = false, timer: ReturnType<typeof setTimeout> | undefined
    let transition: ReturnType<typeof gsap.timeline> | undefined
    let touchY = 0, touchDelta = 0
    const pane = () => panels[index]!
    savePosition = () => {
      returnPosition.value = { scene: pane().dataset.pageScene!, scrollTop: pane().scrollTop }
    }
    const canScroll = (direction: number) => {
      const current = pane()
      return direction > 0 ? current.scrollTop + current.clientHeight < current.scrollHeight - 2 : current.scrollTop > 2
    }
    const publish = (panel: HTMLElement, state: 'inactive' | 'entering' | 'active') => {
      panel.dataset.sceneState = state
      panel.inert = state !== 'active'
      panel.setAttribute('aria-hidden', String(state === 'inactive'))
      panel.dispatchEvent(new Event(state === 'active' ? 'page-scene-enter' : state === 'entering' ? 'page-scene-prepare' : 'page-scene-leave'))
    }
    // 普通文档流中所有分区同时可见，也要发布 active，确保各段动画不会停在准备态。
    const enableNaturalFlow = () => {
      gsap.set(panels, { clearProps: 'visibility,transform,opacity,zIndex' })
      panels.forEach(panel => publish(panel, 'active'))
    }
    const measure = () => {
      const header = options.headerHeight ?? document.querySelector('.header-inner')?.getBoundingClientRect().height ?? 84
      el.style.setProperty('--scene-header', `${header}px`)
    }
    const headerObserver = new ResizeObserver(measure)
    const headerElement = document.querySelector('.header-inner')
    if (headerElement) headerObserver.observe(headerElement)
    measure()
    ready.value = sceneMode
    locked.value = sceneMode
    await nextTick()
    if (destroyed) return
    if (sceneMode) {
      panels.forEach(panel => publish(panel, 'inactive'))
      panels.forEach((panel, i) => gsap.set(panel, { visibility: i === index ? 'visible' : 'hidden', yPercent: 0, opacity: 1 }))
      if (restoring) pane().scrollTop = returnPosition.value!.scrollTop
    } else {
      enableNaturalFlow()
    }
    const activateFirst = () => {
      if (!sceneMode || pending.value) return
      publish(pane(), 'active')
      if (restoring) pane().focus({ preventScroll: true })
    }
    activateFirst()
    const stopPending = watch(pending, activateFirst)
    const change = (nextIndex: number) => {
      if (switching || pending.value || nextIndex < 0 || nextIndex >= panels.length || nextIndex === index) return
      switching = true
      const previous = pane(), next = panels[nextIndex]!
      const direction = Math.sign(nextIndex - index)
      publish(previous, 'inactive')
      // 离开时焦点回到场景本身，防止旧链接随屏幕隐藏。
      if (previous.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
      next.scrollTop = 0
      publish(next, 'entering')
      gsap.set(previous, { zIndex: 1 })
      gsap.set(next, { visibility: 'visible', zIndex: 2, yPercent: direction * 100, opacity: 1 })
      transition = gsap.timeline({ onComplete: () => {
        gsap.set(previous, { visibility: 'hidden', yPercent: 0, opacity: 1 })
        index = nextIndex
        switching = false
        publish(next, 'active')
        next.focus({ preventScroll: true })
      } })
      const duration = reduced.matches ? 0 : (options.duration ?? sceneMotionConfig.duration)
      transition.to(previous, { yPercent: -direction * 18, opacity: .65, duration, ease: 'power2.inOut' }, 0)
      transition.to(next, { yPercent: 0, duration, ease: 'power2.inOut' }, 0)
    }
    navigateToScene = (scene: string) => {
      const targetIndex = panels.findIndex(panel => panel.dataset.pageScene === scene)
      if (!sceneMode) {
        panels[targetIndex]?.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'auto' : 'smooth' })
        return
      }
      change(targetIndex)
    }
    const wheel = (event: WheelEvent) => {
      if (!sceneMode) return
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      const direction = Math.sign(event.deltaY)
      if (!direction) return
      clearTimeout(timer)
      timer = setTimeout(() => { gestureLocked = false; interiorGesture = false; wheelTotal = 0; wheelDirection = 0 }, sceneMotionConfig.wheelIdleMs)
      if (switching || pending.value || gestureLocked) { event.preventDefault(); return }
      if (canScroll(direction)) { interiorGesture = true; return }
      event.preventDefault()
      if (interiorGesture) return
      if (wheelDirection !== direction) wheelTotal = 0
      wheelDirection = direction
      wheelTotal += Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pane().clientHeight : 1)
      if (wheelTotal >= sceneMotionConfig.wheelThreshold) { gestureLocked = true; change(index + direction) }
    }
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; touchDelta = 0 }
    const touchMove = (event: TouchEvent) => {
      if (!sceneMode) return
      const delta = touchY - (event.touches[0]?.clientY ?? touchY)
      if (switching || pending.value) { event.preventDefault(); return }
      if (!canScroll(Math.sign(delta))) { event.preventDefault(); touchDelta = delta }
    }
    const touchEnd = () => { if (sceneMode && Math.abs(touchDelta) > 55) change(index + Math.sign(touchDelta)); touchDelta = 0 }
    const key = (event: KeyboardEvent) => {
      if (!sceneMode) return
      if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, [contenteditable="true"]')) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const direction = ['ArrowDown', 'PageDown', ' '].includes(event.key) ? (event.shiftKey ? -1 : 1) : ['ArrowUp', 'PageUp'].includes(event.key) ? -1 : 0
      if (switching || pending.value) { if (direction) event.preventDefault(); return }
      if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); change(event.key === 'Home' ? 0 : panels.length - 1); return }
      if (direction) {
        event.preventDefault()
        if (canScroll(direction)) pane().scrollBy({ top: direction * pane().clientHeight * .8, behavior: reduced.matches ? 'instant' : 'smooth' })
        else change(index + direction)
      }
    }
    const syncViewportMode = () => {
      const nextMode = options.sceneMode !== false && sceneViewport.matches
      if (nextMode === sceneMode) return
      sceneMode = nextMode
      transition?.kill()
      transition = undefined
      switching = false
      gestureLocked = false
      interiorGesture = false
      wheelTotal = 0
      wheelDirection = 0
      if (!sceneMode) {
        ready.value = false
        locked.value = false
        enableNaturalFlow()
        return
      }
      // 从普通文档流恢复到分场时，以最接近导航下方的分区作为当前场景。
      const header = document.querySelector('.header-inner')?.getBoundingClientRect().height || 84
      let nearest = 0
      let nearestDistance = Number.POSITIVE_INFINITY
      panels.forEach((panel, i) => {
        const distance = Math.abs(panel.getBoundingClientRect().top - header)
        if (distance < nearestDistance) {
          nearest = i
          nearestDistance = distance
        }
      })
      index = nearest
      ready.value = true
      locked.value = true
      panels.forEach((panel, i) => {
        gsap.set(panel, { visibility: i === index ? 'visible' : 'hidden', yPercent: 0, opacity: 1, zIndex: 0 })
        if (i !== index) publish(panel, 'inactive')
      })
      activateFirst()
      pane().focus({ preventScroll: true })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('touchstart', touchStart, { passive: true })
    el.addEventListener('touchmove', touchMove, { passive: false })
    el.addEventListener('touchend', touchEnd)
    window.addEventListener('keydown', key)
    const resize = () => {
      measure()
      syncViewportMode()
    }
    window.addEventListener('resize', resize)
    sceneViewport.addEventListener('change', syncViewportMode)
    dispose = () => {
      stopPending(); clearTimeout(timer); transition?.kill(); headerObserver.disconnect()
      panels.forEach(panel => { panel.inert = false; panel.removeAttribute('aria-hidden') })
      el.removeEventListener('wheel', wheel); el.removeEventListener('touchstart', touchStart)
      el.removeEventListener('touchmove', touchMove); el.removeEventListener('touchend', touchEnd)
      window.removeEventListener('keydown', key); window.removeEventListener('resize', resize)
      sceneViewport.removeEventListener('change', syncViewportMode)
    }
  })
  onBeforeUnmount(() => { savePosition(); destroyed = true; dispose() })
  return { ready, goToScene: (scene: string) => navigateToScene?.(scene) }
}
