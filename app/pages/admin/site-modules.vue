<script setup lang="ts">
import ModuleManagement from '~/components/admin/business/ModuleManagement.vue'
definePageMeta({layout:'admin',admin:true,middleware:'admin',adminPermission:'content.modules.read',adminTitle:'模块管理'})
defineI18nRoute(false)
</script>

<template><ModuleManagement/></template>
