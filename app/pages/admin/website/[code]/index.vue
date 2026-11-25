<script setup lang="ts">
import PageSettingsModule from '~/components/admin/website/pages/MaintenanceModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'content.pages.read',
  adminTitle: '网页维护'
})
defineI18nRoute(false)
</script>
<template>
  <PageSettingsModule/>
</template>
