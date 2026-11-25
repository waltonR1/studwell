<!-- 搜索高亮仅渲染文本节点，不接受 HTML。 -->
<script setup lang="ts">
import { highlight } from '~/utils/public/runtime/search/engine'
const props = defineProps<{ text: string; query: string }>()
const segments = computed(() => highlight(props.text, props.query))
</script>
<template><template v-for="(segment, i) in segments" :key="i"><mark v-if="segment.hit">{{ segment.text }}</mark><template v-else>{{ segment.text }}</template></template></template>
<style scoped>mark { background: #b51f2a12; color: var(--color-brand-red); padding: 0; }</style>
