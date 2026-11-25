<script setup lang="ts">
import SettingsModule from '~/components/admin/website/languages/MaintenanceModule.vue'
definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.site_languages.read',adminTitle:'站点语言'})
defineI18nRoute(false)
</script>
<template><SettingsModule/></template>
