// 管理画布自定义指针的绘制、交互和生命周期。
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

// 所有尺寸以 CSS 像素计；插值系数按 60Hz 归一化，避免高刷屏加速。
export const cursorConfig = {
  // 普通与 Hover 状态统一使用小方块，仅保留按压收缩反馈。
  size: 5, pressScale: 0.76,
  offsetX: 0, offsetY: 0,
  // 对齐 Heron 公开脚本：颜色、34点轨迹、线宽与速度衰减参数。
  color: '#FA3600', follow: 0.18, sizeFollow: 0.24,
  speedFollow: 0.2, speedCutoff: 1.5, speedRange: 6,
  trailWidth: 1.4, trailOpacity: 0.7, motionThreshold: 0.05,
  sampleInterval: 1000 / 60, maxPoints: 34, threshold: 0.01, maxDpr: 2,
} as const

const native = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), iframe, [data-cursor="native"]'

export function useCustomCursor(canvas: Ref<HTMLCanvasElement | null>) {
  const route = useRoute()
  let reset = () => {}
  let dispose = () => {}
  watch(() => route.fullPath, () => reset())

  onMounted(() => {
    const el = canvas.value
    if (!el) return
    const media = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let stop = () => {}

    const start = () => {
      stop()
      if (!media.matches) return
      const ctx = el.getContext('2d')
      if (!ctx) return
      const config = cursorConfig
      // 保存运动路径；与参考站一致，消退由速度控制，不使用固定寿命。
      const points: { x: number; y: number }[] = []
      const head = { x: 0, y: 0 }
      let lastSample = 0
      let speed = 0
      let x = 0, y = 0, size: number = config.size, pressed = false
      let visible = false, frame = 0, previous = 0
      let width = 0, height = 0, target: EventTarget | null = null
      // 仅该视觉使用参考色，不改全站主题；原生鼠标尖仍位于方块中心。
      const ink = config.color
      const clear = () => ctx.clearRect(0, 0, width, height)
      const hide = () => {
        cancelAnimationFrame(frame)
        frame = 0
        previous = 0
        visible = false
        pressed = false
        target = null
        points.length = 0
        lastSample = 0
        speed = 0
        clear()
      }
      const draw = (time: number) => {
        frame = 0
        if (!visible) return
        const dt = previous ? Math.min((time - previous) / (1000 / 60), 3) : 1
        previous = time
        const follow = 1 - (1 - config.follow) ** dt
        const desired = config.size * (pressed ? config.pressScale : 1)
        size += (desired - size) * (1 - (1 - config.sizeFollow) ** dt)
        const previousX = head.x, previousY = head.y
        head.x += (x - head.x) * follow
        head.y += (y - head.y) * follow
        const error = Math.max(Math.abs(desired - size), Math.abs(head.x - x), Math.abs(head.y - y))
        if (error < config.threshold) {
          head.x = x
          head.y = y
          size = desired
        }
        const movement = Math.hypot(head.x - previousX, head.y - previousY) / dt
        speed += (movement - speed) * (1 - (1 - config.speedFollow) ** dt)
        // 轨迹采样以60Hz为上限，高刷新率不缩短拖尾，静止时不补点。
        if (time - lastSample >= config.sampleInterval - 0.1 && movement > config.motionThreshold) {
          points.push({ x: head.x, y: head.y })
          lastSample = time
          if (points.length > config.maxPoints) points.shift()
        }
        clear()
        ctx.fillStyle = ink
        ctx.strokeStyle = ink
        ctx.lineWidth = config.trailWidth
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        const strength = Math.min(1, Math.max(0, (speed - config.speedCutoff) / config.speedRange))
        // 参考站用路径序号平方控制透明度，并随速度下降整体淡出。
        if (strength > 0.02) {
          for (let i = 1; i < points.length; i++) {
            const before = points[i - 1]!, point = points[i]!
            ctx.globalAlpha = (i / points.length) ** 2 * config.trailOpacity * strength
            ctx.beginPath()
            ctx.moveTo(before.x, before.y)
            ctx.lineTo(point.x, point.y)
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
        ctx.fillRect(head.x - size / 2, head.y - size / 2, size, size)
        if (speed <= config.speedCutoff && movement <= config.motionThreshold) points.length = 0
        if (error >= config.threshold || speed > config.speedCutoff) frame = requestAnimationFrame(draw)
        else previous = 0
      }
      const wake = () => { if (visible && !frame) frame = requestAnimationFrame(draw) }
      const updateTarget = (element: EventTarget | null) => {
        target = element
        const node = element instanceof Element ? element : null
        if (!node || node.closest(native) || window.getSelection()?.type === 'Range') {
          hide()
          return false
        }
        return true
      }
      const move = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') { hide(); return }
        x = event.clientX + config.offsetX
        y = event.clientY + config.offsetY
        if (document.hidden || !document.hasFocus()) return
        if (event.target !== target && !updateTarget(event.target)) return
        if (!visible) {
          head.x = x
          head.y = y
          points.push({ x, y })
          size = config.size
          visible = true
        }
        wake()
      }
      const over = (event: PointerEvent) => { if (visible && updateTarget(event.target)) wake() }
      const down = (event: PointerEvent) => { if (event.pointerType === 'mouse' && visible) { pressed = true; wake() } }
      const up = () => { pressed = false; wake() }
      const out = (event: PointerEvent) => { if (!event.relatedTarget) hide() }
      const selection = () => { if (window.getSelection()?.type === 'Range') hide() }
      const resize = () => {
        hide()
        width = window.innerWidth
        height = window.innerHeight
        const dpr = Math.min(window.devicePixelRatio || 1, config.maxDpr)
        el.width = Math.round(width * dpr)
        el.height = Math.round(height * dpr)
        el.style.width = `${width}px`
        el.style.height = `${height}px`
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      // 全局事件委托；使用同一 AbortController 一次性回收本轮全部监听器。
      const controller = new AbortController()
      const options = { passive: true, signal: controller.signal }
      document.addEventListener('pointermove', move, options)
      document.addEventListener('pointerover', over, options)
      document.addEventListener('pointerout', out, options)
      document.addEventListener('pointerdown', down, options)
      document.addEventListener('pointerup', up, options)
      document.addEventListener('pointercancel', hide, options)
      document.addEventListener('visibilitychange', hide, options)
      document.addEventListener('selectionchange', selection, options)
      window.addEventListener('blur', hide, options)
      window.addEventListener('resize', resize, options)
      // Canvas 使用视口坐标，滚动不清空轨迹、不重置跟随状态，也不启动额外 RAF。
      reset = hide
      resize()
      stop = () => {
        controller.abort()
        hide()
        // 禁用时释放位图，触摸和 reduced-motion 模式不保留全屏 backing store。
        el.width = el.height = 0
        reset = () => {}
      }
    }
    media.addEventListener('change', start)
    start()
    dispose = () => { media.removeEventListener('change', start); stop() }
  })
  onBeforeUnmount(() => dispose())
}
