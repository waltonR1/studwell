// 保留原版主新闻与右侧条目的分层展开，切屏完成后按秒自动归位。
import { useHomeMotionLifecycle } from '~/composables/public/sections/home/useHomeMotionLifecycle'
import { playOnSceneEnter } from '~/utils/public/sections/home/sceneEntrance'
const motionConfig = {duration: .275} as const

export function useNewsMotion(root: Ref<HTMLElement | null>) {
  const seen = new WeakSet<HTMLElement>()
  useHomeMotionLifecycle(root, ({ el, gsap, viewport }) => {
    const grid = el.querySelector<HTMLElement>('.home-news-grid')
    if (!grid) return
    const items = Array.from(grid.querySelectorAll<HTMLElement>('.featured-news, .home-news-item'))
    const entrance = motionConfig.duration
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
    if (viewport.mobile) {
      items.forEach(item => {
        const image = item.querySelector<HTMLElement>('.featured-news-image')
        if (image) {
          tl.fromTo(image, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0%)', duration: entrance }, 0)
          const photo = image.querySelector('.industrial-visual')
          if (photo) tl.fromTo(photo, { scale: 1.08, transformOrigin: 'center center' }, { scale: 1, duration: entrance }, 0)
        }
        const copy = item.querySelectorAll('.home-news-meta, h3, .home-news-summary')
        tl.fromTo(copy, { y: image ? 20 : 16, opacity: 0 }, { y: 0, opacity: 1, duration: entrance * (image ? .75 : 1) }, image ? entrance * .1 : 0)
      })
    } else {
      const featured = grid.querySelector<HTMLElement>('.featured-news')!
      const photo = featured.querySelector('.featured-news-image .industrial-visual')
      const stacked = viewport.belowDesktop
      tl.fromTo(featured, { xPercent: stacked ? 0 : 18, y: stacked ? 36 : 64, scale: stacked ? .96 : .86, transformOrigin: 'right top', clipPath: stacked ? 'inset(0% 0% 18% 0%)' : 'inset(0% 0% 0% 38%)', opacity: 0 }, {
        xPercent: 0, y: 0, scale: 1, clipPath: 'inset(0%)', opacity: 1, duration: entrance * .78,
      }, 0)
      if (photo) tl.fromTo(photo, { scale: stacked ? 1.08 : 1.2, xPercent: stacked ? 0 : -6 }, { scale: 1, xPercent: 0, duration: entrance * .88 }, 0)
      items.filter(item => item !== featured).forEach((item, index) => {
        const start = entrance * (index === 0 ? .12 : .24)
        tl.fromTo(item, { xPercent: stacked ? 0 : 18, y: stacked ? 24 : index === 0 ? -64 : 96, clipPath: index === 0 ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)', opacity: 0 }, {
          xPercent: 0, y: 0, clipPath: 'inset(0%)', opacity: 1, duration: entrance - start,
        }, start)
      })
    }
    return playOnSceneEnter(grid, tl, seen, items)
  })
}
