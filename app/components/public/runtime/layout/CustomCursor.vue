<!-- 处理官网自定义指针的显示与交互。 -->
<script setup lang="ts">
import { useCustomCursor } from '~/composables/public/runtime/useCustomCursor'

const canvas = ref<HTMLCanvasElement | null>(null)
useCustomCursor(canvas)
</script>

<template>
  <canvas ref="canvas" class="custom-cursor" aria-hidden="true" />
</template>

<style>
.custom-cursor { display: none; position: fixed; inset: 0; z-index: 10000; pointer-events: none; }
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .custom-cursor { display: block; }
}
</style>
