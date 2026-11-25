<!-- 首页品牌加载层：展示多倍率透明 Logo，利用首屏资源准备时间完成开场，并以有上限的等待揭开首页。 -->
<script setup lang="ts">
import {useBrandIdentity} from '~/composables/public/runtime/useBrandIdentity'
const brandName=useBrandIdentity()
import SiteImage from '~/components/public/ui/SiteImage.vue'
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
const {settings} = useSiteSettings()
const brandLogo = computed(() => settings.value?.basic?.logo ? {...settings.value.basic.logo, alt: brandName.value} : null)
import { loadGsapRuntime } from '~/utils/public/runtime/gsapRuntime'
import { useBrandEntrance } from '~/composables/public/runtime/useBrandEntrance'
import { useBodyScrollLock } from '~/composables/public/runtime/useBodyScrollLock'
const { blocking, finish } = useBrandEntrance()
const route = useRoute()
const locked = ref(false)
const leaving = ref(false)
useBodyScrollLock(locked)
let disposed = false
let closing = false
const timers = new Set<ReturnType<typeof setTimeout>>()
const cleanups: (() => void)[] = []
const delay = (ms: number) => new Promise<void>(resolve => {
  const timer = setTimeout(() => { timers.delete(timer); resolve() }, ms)
  timers.add(timer)
})
// 图片准备只检查当前 Hero；失败也允许继续，不等待所有下方图片。
const preparePhoto = () => new Promise<void>(resolve => {
  const photo = document.querySelector<HTMLImageElement>('.hero-section .media-photo')
  if (!photo) { resolve(); return }
  const done = () => {
    photo.removeEventListener('load', done); photo.removeEventListener('error', done)
    if (photo.complete && photo.naturalWidth) void photo.decode().catch(() => {}).then(resolve)
    else resolve()
  }
  if (photo.complete) { done(); return }
  photo.addEventListener('load', done, { once: true }); photo.addEventListener('error', done, { once: true })
  cleanups.push(() => { photo.removeEventListener('load', done); photo.removeEventListener('error', done) })
})
const close = async (instant = false) => {
  if (disposed || closing) return
  closing = true
  leaving.value = true
  if (!instant) await delay(450)
  if (disposed) return
  locked.value = false
  finish()
}
const key = (event: KeyboardEvent) => { if (event.key === 'Escape') void close(true) }
onMounted(async () => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (route.hash || window.scrollY > 8 || performance.now() > 3000) { void close(true); return }
  locked.value = true; blocking.value = true
  window.addEventListener('keydown', key)
  await nextTick()
  // 至少 750ms 的品牌节奏；资源最多等待 2200ms，随后退出。减少动态效果不强制等待。
  const resources = Promise.allSettled([preparePhoto(), document.fonts.ready, loadGsapRuntime()])
  await Promise.all([delay(reduced ? 0 : 750), Promise.race([resources, delay(reduced ? 500 : 2200)])])
  if (!disposed) void close(reduced)
})
onBeforeUnmount(() => {
  disposed = true
  timers.forEach(clearTimeout); timers.clear()
  cleanups.forEach(cleanup => cleanup())
  window.removeEventListener('keydown', key)
  locked.value = false; blocking.value = false
})
</script>

<template>
  <div class="brand-loader" :class="{ 'is-leaving': leaving }" role="status" aria-live="polite">
    <!-- 与 Header 共用透明 PNG，按设备像素密度选择清晰资源。 -->
    <div class="brand-loader-mark">
      <SiteImage
        v-if="brandLogo" :image="brandLogo"
        width="300"
        height="110"
        fetchpriority="high"
      />
      <span class="brand-loader-rule" aria-hidden="true" />
    </div>
    <span class="sr-only">{{ $t('common.loadingHome') }}</span>
  </div>
</template>

<style scoped>
/* 顶层品牌画布：轻量 CSS 开场，不依赖 GSAP 下载后才显示。 */
.brand-loader { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; background: var(--color-brand-paper); transition: transform 450ms cubic-bezier(.76, 0, .24, 1); animation: brand-loader-failsafe 0s 6s forwards; }
.brand-loader.is-leaving { transform: translateY(-100%); }
.brand-loader-mark { display: grid; justify-items: center; gap: 28px; }
.brand-loader-mark img { display: block; width: clamp(210px, 22vw, 300px); height: auto; object-fit: contain; animation: brand-logo-reveal 750ms cubic-bezier(.22, 1, .36, 1) both; }
.brand-loader-rule { display: block; width: 64px; height: 2px; background: var(--color-brand-red); transform-origin: left center; animation: brand-rule-reveal 900ms ease both; }
/* 客户端脚本异常时也不永久遮挡 SSR 正文；迟到的初始化直接跳过品牌开场。 */
@keyframes brand-loader-failsafe { to { visibility: hidden; pointer-events: none; } }
@keyframes brand-logo-reveal { from { clip-path: inset(0% 100% 0% 0%); opacity: .2; transform: translateY(12px); } to { clip-path: inset(0%); opacity: 1; transform: translateY(0); } }
@keyframes brand-rule-reveal { from { transform: scaleX(0); } to { transform: scaleX(1); } }
/* 系统减少动态效果：不播放 Logo 和揭幕位移。 */
@media (prefers-reduced-motion: reduce) { .brand-loader { transition: none; } .brand-loader-mark img, .brand-loader-rule { animation: none; } }
</style>
