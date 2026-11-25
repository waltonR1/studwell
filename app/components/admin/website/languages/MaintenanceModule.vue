<!-- 站点语言维护入口：装配语言适配器和表单。 -->
<script setup lang="ts">
import MaintenanceFrame from '../shared/MaintenanceFrame.vue'
import SettingsContent from './SettingsContent.vue'
import {useLanguageMaintenance} from '~/composables/admin/website/useLanguageMaintenance'
const adapter=useLanguageMaintenance()
</script>
<template>
 <MaintenanceFrame :adapter="adapter"><SettingsContent v-bind="adapter.contentProps.value" /></MaintenanceFrame>
</template>
