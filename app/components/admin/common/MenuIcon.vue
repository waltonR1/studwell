<script setup lang="ts">
import {adminMenuIcons} from '~/config/admin/menu-icons'
import type {MenuIconKey} from '#shared/types/admin/menus'

defineProps<{ iconKey: MenuIconKey }>()

</script>
<template>
  <component :is="adminMenuIcons[iconKey]" aria-hidden="true"/>
</template>
