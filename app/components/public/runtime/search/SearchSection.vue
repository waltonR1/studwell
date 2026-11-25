<!-- 统一入口：只负责选择展示端，具体组件直接调用业务 composable。 -->
<script setup lang="ts">
import DesktopView from './SearchSection/Desktop.vue'
import MobileView from './SearchSection/Mobile.vue'
import {usePublicViewport} from '~/composables/public/runtime/usePublicViewport'
defineOptions({inheritAttrs: false})
const mobile = usePublicViewport()
</script>
<template>
  <component :is="mobile ? MobileView : DesktopView" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps"><slot :name="name" v-bind="slotProps || {}" /></template>
  </component>
</template>
