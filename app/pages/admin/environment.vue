<script setup lang="ts">
import OverviewModule from '~/components/admin/environment/OverviewModule.vue'

definePageMeta({layout: 'admin', admin: true, middleware: 'admin', adminPermission: 'system.environment.read', adminTitle: '系统环境'})
defineI18nRoute(false)
useHead({title: '系统环境'})
</script>
<template><OverviewModule/></template>
