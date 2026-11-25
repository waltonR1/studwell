<script setup lang="ts">
import {Video} from 'lucide-vue-next'
const props = defineProps<{src: string}>()
const container = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)
let dispose: (() => void) | undefined
let observer: IntersectionObserver | undefined

function capture() {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const cleanup = () => {
    clearTimeout(timeout)
    video.onloadedmetadata = video.onseeked = video.onloadeddata = video.onerror = null
    video.removeAttribute('src')
    video.load()
  }
  const timeout = setTimeout(cleanup, 8000)
  dispose = cleanup
  const draw = () => {
    const target = canvas.value
    if (!target || !video.videoWidth || video.readyState < 2) return
    target.width = 160
    target.height = 104
    // 浏览器内临时预览，不生成或保存封面文件。
    const context = target.getContext('2d')
    if (context) {
      const scale = Math.min(target.width / video.videoWidth, target.height / video.videoHeight)
      const width = video.videoWidth * scale, height = video.videoHeight * scale
      context.drawImage(video, (target.width-width)/2, (target.height-height)/2, width, height)
      ready.value = true
    }
    cleanup()
  }
  video.onloadedmetadata = () => {
    if (Number.isFinite(video.duration) && video.duration > 0.1) video.currentTime = 0.1
    else video.onloadeddata = draw
  }
  video.onseeked = draw
  video.onerror = cleanup
  video.src = props.src
}

onMounted(() => {
  if (!container.value) return
  if (!('IntersectionObserver' in window)) { capture(); return }
  observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); capture() }
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => { observer?.disconnect(); dispose?.() })
</script>
<template>
  <span ref="container" class="video-thumbnail" aria-hidden="true">
    <canvas ref="canvas" v-show="ready"/>
    <Video v-if="!ready" :size="24"/>
  </span>
</template>
<style scoped>
.video-thumbnail{display:grid;place-items:center;width:80px;height:52px;background:#f1f5f9;color:#64748b;border-radius:4px;overflow:hidden}
.video-thumbnail canvas{display:block;width:100%;height:100%;object-fit:contain}
</style>
