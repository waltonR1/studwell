<script setup lang="ts">
import ListModule from '~/components/admin/tasks/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.tasks.read',
  adminTitle: '定时任务'
})
defineI18nRoute(false)
useHead({title: '定时任务'})
</script>
<template>
  <ListModule/>
</template>
