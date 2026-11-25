<!-- 向当前区块及其子组件提供发布实例 ID。 -->
<script setup lang="ts">
import {providePublicSection} from '~/composables/public/runtime/usePublicPage'
const props = defineProps<{id: string}>()
providePublicSection(() => props.id)
</script>
<template><slot /></template>
