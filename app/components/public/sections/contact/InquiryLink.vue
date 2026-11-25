<!-- 通用咨询链接：当前统一进入联系方式页面。 -->
<script setup lang="ts">
import {isExternalSiteLink} from '#shared/utils/website/site-link'
const {target}=defineProps<{target:string}>()
const localePath = useLocalePath()
const to = computed(() => isExternalSiteLink(target)?target:localePath(target))
</script>

<template>
  <NuxtLink v-if="to" :to="to"><slot /></NuxtLink>
  <slot v-else />
</template>
