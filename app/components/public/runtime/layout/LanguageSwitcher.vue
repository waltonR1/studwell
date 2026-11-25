<!-- 语言切换组件：封装语言按钮、顶层弹窗、语言链接、滚动锁与焦点管理。 -->
<script setup lang="ts">
import {useSiteSettings} from '~/composables/public/runtime/useSiteSettings'
import {searchLocaleLocation} from '~/utils/public/runtime/search/localeNavigation'
import HoverLabel from '~/components/public/runtime/layout/HoverLabel.vue'
// 脚本职责：封装原生模态弹窗、语言路由、滚动锁以及关闭后的焦点恢复。
import { Globe, X } from 'lucide-vue-next'
import { useBodyScrollLock } from '~/composables/public/runtime/useBodyScrollLock'
const { locales, locale } = useI18n()
const {settings}=useSiteSettings()
const enabledLocales=computed(()=>locales.value.filter(language=>settings.value?.languages.enabledLocales.includes(language.code)??false))
const switchLocalePath = useSwitchLocalePath()
const route = useRoute()
function languagePath(code: typeof locale.value){return searchLocaleLocation(switchLocalePath(code),route)}
const emit = defineEmits<{ open: [] }>()
const opened = ref(false)
const closing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
let destroyed = false
const trigger = ref<HTMLButtonElement>()
const dialog = ref<HTMLDialogElement>()
const titleId = useId()
// 与其他面板共用滚动锁，避免关闭弹窗时误解除手机菜单的锁。
useBodyScrollLock(opened)
// 原生模态弹窗负责焦点约束，父组件只接收打开通知。
async function show() {
  emit('open')
  await nextTick()
  if (!dialog.value || destroyed) return
  // 退场尚未结束时再次点击入口，取消关闭，继续保留原生焦点约束。
  clearTimeout(closeTimer)
  closing.value = false
  if (dialog.value.open) return
  dialog.value.showModal()
  opened.value = true
}
function close() {
  if (!dialog.value?.open || closing.value) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { closeNow(); return }
  closing.value = true
  // 退场由CSS控制；兜底计时防止animationend因样式切换缺失而残留模态锁。
  closeTimer = setTimeout(closeNow, 220)
}
function closeNow() {
  clearTimeout(closeTimer)
  if (dialog.value?.open) dialog.value.close()
  finishClose()
}
function onAnimationEnd(event: AnimationEvent) {
  if (event.target === dialog.value && closing.value) closeNow()
}
function finishClose() {
  clearTimeout(closeTimer)
  closing.value = false
  if (!opened.value) return
  opened.value = false
  if (!destroyed) trigger.value?.focus()
}
// 原生close事件异步派发，若此时已重新打开，不清空新一轮状态。
function onNativeClose() { if (!dialog.value?.open) finishClose() }
// 通过点击坐标区分原生遮罩和面板内部，避免内部留白误关闭。
function backdropClick(event: MouseEvent) {
  const panel = dialog.value
  if (!panel || event.target !== panel) return
  const rect = panel.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
}
watch(() => route.fullPath, () => { if (opened.value) closeNow() })
onBeforeUnmount(() => { destroyed = true; clearTimeout(closeTimer); if (dialog.value?.open) dialog.value.close() })
</script>

<template>
  <!-- 桌面与手机共用的语言按钮。 -->
  <button ref="trigger" class="header-language" :aria-label="$t('common.language')" aria-haspopup="dialog" :aria-expanded="opened" @click="show">
    
    <Globe :size="18" /><HoverLabel :text="locale.toUpperCase()" />
  </button>
  <!-- 弹窗挂载到 body，避开父组件的定位、层级和裁切约束。 -->
  <ClientOnly>
    <Teleport to="body">
      <dialog ref="dialog" class="language-dialog" :class="{ closing }" :aria-labelledby="titleId" @animationend="onAnimationEnd" @cancel.prevent="close" @close="onNativeClose" @click="backdropClick">
        <div class="language-dialog-heading">
          <h2 :id="titleId"><Globe :size="20" />{{ $t('common.language') }}</h2>
          <button class="language-dialog-close" :aria-label="$t('common.close')" autofocus @click="close"><X :size="22" /></button>
        </div>
        <nav :aria-label="$t('common.language')" class="language-list">
          <NuxtLink v-for="lang in enabledLocales" :key="lang.code" :to="languagePath(lang.code)" :lang="lang.language" :aria-current="locale === lang.code ? 'true' : undefined" @click="close"><HoverLabel :text="lang.name ?? lang.code" /><span class="language-code" aria-hidden="true">{{ lang.code.toUpperCase() }}</span></NuxtLink>
        </nav>
      </dialog>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
/* 按钮/选项采用整行文字滚动与红色标识反馈；动画只改变视觉，不参与首页滚动轨道。 */
.header-language { position: relative; display: flex; align-items: center; flex: none; margin-left: auto; min-height: 44px; padding: 12px; border: 0; background: transparent; color: var(--header-fg, inherit); font-family: var(--font-sans); font-size: var(--text-small); font-weight: var(--font-weight-semibold); gap: 9px; transition: background-color 200ms ease, color 200ms ease; }
.header-language::after { content: ''; position: absolute; bottom: 3px; left: 12px; right: 12px; height: 2px; background: var(--header-accent, var(--color-brand-red)); transform: scaleX(0); transform-origin: left; transition: transform 220ms ease; }
.header-language:active, .header-language:focus-visible { background: var(--header-hover-bg, transparent); color: var(--header-fg, var(--color-brand-red)); }
.header-language[aria-expanded="true"] { background: #fff; color: var(--color-brand-red); }
.header-language[aria-expanded="true"]::after { background: currentColor; }

.header-language[aria-expanded="true"]::after, .header-language:focus-visible::after { transform: scaleX(1); }
.language-dialog { margin: auto; width: min(420px,calc(100vw - 40px)); max-height: calc(100dvh - 40px); overflow-y: auto; padding: 24px; border: 1px solid #18283220; background: #fff; color: var(--color-brand-text); box-shadow: 0 24px 80px #18283230; }
.language-dialog[open] { animation: language-panel-in 220ms cubic-bezier(.22,1,.36,1) both; }
.language-dialog[open].closing { animation: language-panel-out 160ms ease both; }
.language-dialog::backdrop { background: #08121b99; animation: language-backdrop-in 220ms ease both; }
.language-dialog.closing::backdrop { animation: language-backdrop-out 160ms ease both; }
.language-dialog-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 18px; border-bottom: 1px solid #18283220; }
.language-dialog-heading h2 { display: flex; align-items: center; gap: 12px; font-size: var(--text-subtitle); font-weight: var(--font-weight-semibold); }
.language-dialog-close { display: grid; place-items: center; width: 44px; height: 44px; background: transparent; color: var(--color-brand-red); border: 1px solid #18283220; transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease; }
.language-dialog-close:active { background: #f5e9e9; border-color: var(--color-brand-red); }
.language-dialog-close svg { transition: transform 220ms ease; }
.language-dialog .language-list { display: grid; gap: 6px; margin-top: 18px; }
.language-dialog .language-list a { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; border-left: 3px solid transparent; line-height: var(--leading-compact); font-size: var(--text-small); transition: color 200ms ease, border-color 200ms ease, background-color 200ms ease; }
.language-code { font-family: var(--font-sans); font-size: var(--text-label); letter-spacing: var(--tracking-label); opacity: .6; }
.language-dialog .language-list a[aria-current] { background: #f5e9e9; border-left-color: var(--color-brand-red); color: var(--color-brand-red); font-weight: var(--font-weight-semibold); }
.language-dialog .language-list a:active, .language-dialog .language-list a:focus-visible { color: var(--color-brand-red); border-left-color: var(--color-brand-red); }
.header-language:focus-visible, .language-dialog-close:focus-visible, .language-list a:focus-visible { outline: 2px solid var(--header-focus, var(--color-brand-red)); outline-offset: 3px; }
@keyframes language-panel-in { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes language-panel-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(8px) scale(.98); } }
@keyframes language-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes language-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
/* 仅精细指针启用Hover，触屏通过当前项、按压与焦点反馈。 */
@media (hover: hover) and (pointer: fine) {
  .header-language:hover { --label-shift: -100%; }
  .header-language:not([aria-expanded="true"]):hover { color: var(--header-fg, var(--color-brand-red)); background: var(--header-hover-bg, transparent); }
  .header-language:hover::after { transform: scaleX(1); }
  .language-dialog-close:hover { background: #f5e9e9; border-color: var(--color-brand-red); }
  .language-dialog-close:hover svg { transform: rotate(90deg); }
  .language-dialog .language-list a:not([aria-current]):hover { --label-shift: -100%; color: var(--color-brand-red); border-left-color: var(--color-brand-red); }
}
@media (min-width: 1024px) { .header-language { margin-left: 0; } }
@media (max-width: 767px) { .header-language { font-size: var(--text-small); } }
@media (prefers-reduced-motion: reduce) {
  .header-language, .header-language::after, .language-dialog-close, .language-dialog-close svg, .language-list a { transition: none; }
  .language-dialog-close:hover svg { transform: none; }
  .language-dialog[open], .language-dialog[open].closing, .language-dialog::backdrop, .language-dialog.closing::backdrop { animation: none; }
}
</style>
