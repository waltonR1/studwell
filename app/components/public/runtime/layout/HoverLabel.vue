<!-- 导航悬停文字：整行上下替换，重复文字仅作装饰，尺寸由原文决定。 -->
<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <span class="hover-label"><span class="hover-label-track"><span>{{ text }}</span><span class="hover-label-copy" aria-hidden="true">{{ text }}</span></span></span>
</template>

<style scoped>
.hover-label { display: block; overflow: hidden; }
.hover-label-track { position: relative; display: block; transform: translateY(var(--label-shift, 0%)); transition: transform 250ms cubic-bezier(.22,1,.36,1); }
.hover-label-copy { position: absolute; top: 100%; left: 0; width: 100%; }
@media (prefers-reduced-motion: reduce) {
  .hover-label-track { transform: none; transition: none; }
}
</style>
