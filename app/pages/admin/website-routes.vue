<script setup lang="ts">
import SettingsModule from '~/components/admin/website/routes/MaintenanceModule.vue'

definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.routes.read',adminTitle:'路由与 SEO'})
defineI18nRoute(false)
</script>

<template><SettingsModule/></template>
