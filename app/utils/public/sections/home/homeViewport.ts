// 首页Motion视口约定：集中宽度断点和Header测量，各段仍独立决定固定条件及时间轴。
const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024
const STAGE_INSET = 24

// 仅在客户端动画初始化时读取；resize/语言重建后重新测量，不共享可变尺寸缓存。
export function measureHomeViewport() {
  const width = window.innerWidth
  const height = window.innerHeight
  const header = document.querySelector('.header-inner')?.getBoundingClientRect().height || 84
  return {
    width,
    height,
    header,
    contentHeight: height - header,
    available: height - header - STAGE_INSET * 2,
    top: header + STAGE_INSET,
    mobile: width < MOBILE_BREAKPOINT,
    belowDesktop: width < DESKTOP_BREAKPOINT,
  }
}
