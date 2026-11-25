// 共用滚动入场：普通自然滚动，不固定Section，不重复隐藏已阅读内容。
import type { Ref } from 'vue'

export function useScrollReveal(root: Ref<HTMLElement | null>) {
  let destroyed = false
  let dispose = () => {}
  onMounted(async () => {
    const el = root.value
    if (!el) return
    try {
      const { gsap } = await import('gsap')
      if (destroyed) return
      const media = gsap.matchMedia()
      dispose = () => media.revert()
      const completed = new WeakSet<HTMLElement>()
      media.add('(prefers-reduced-motion: no-preference)', context => {
        const targets = Array.from(el.querySelectorAll<HTMLElement>('[data-scroll-reveal]'))
        let observer: IntersectionObserver | undefined
        let resizeTimer: ReturnType<typeof setTimeout> | undefined
        targets.forEach(target => {
          if (completed.has(target) || target.getBoundingClientRect().bottom <= 0) return
          gsap.set(target, { opacity: 0, y: window.innerWidth < 768 ? 12 : 20 })
        })
        const observe = () => {
          observer?.disconnect()
          observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
              const target = entry.target as HTMLElement
              if (!entry.isIntersecting || completed.has(target)) continue
              completed.add(target)
              observer?.unobserve(target)
              context.add(() => {
                const mobile = window.innerWidth < 768
                gsap.to(target, { opacity: 1, y: 0, duration: mobile ? .45 : .6,
                  delay: Number(target.dataset.scrollRevealOrder || 0) * (mobile ? .045 : .08),
                  ease: 'power2.out', clearProps: 'opacity,transform' })
              })
            }
          }, { rootMargin: `0px 0px -${Math.round(window.innerHeight * .15)}px 0px`, threshold: 0 })
          targets.forEach(target => { if (!completed.has(target)) observer?.observe(target) })
        }
        const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(observe, 180) }
        observe()
        window.addEventListener('resize', resize)
        return () => { clearTimeout(resizeTimer); observer?.disconnect(); window.removeEventListener('resize', resize) }
      }, el)
    } catch { dispose() }
  })
  onBeforeUnmount(() => { destroyed = true; dispose() })
}
