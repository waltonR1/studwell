<!-- 路由与 SEO 维护入口：装配路由编辑器及新建动作。 -->
<script setup lang="ts">
import MaintenanceFrame from '../shared/MaintenanceFrame.vue'
import SettingsContent from './SettingsContent.vue'
import {useRouteMaintenance} from '~/composables/admin/website/useRouteMaintenance'
const adapter=useRouteMaintenance(),view=adapter.view
</script>
<template>
 <MaintenanceFrame :adapter="adapter">
  <template #actions><UButton v-if="view.ready&&!view.loadError" class="admin-button" :disabled="view.busy" @click="adapter.newRoute()">新建路由</UButton></template>
  <SettingsContent v-bind="adapter.contentProps.value" />
 </MaintenanceFrame>
</template>
