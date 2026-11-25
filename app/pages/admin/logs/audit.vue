<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/logs/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.logs.audit.read',
  adminTitle: '操作审计'
})
defineI18nRoute(false)
useHead({title: `操作审计 | ${companyBrand.name}`})
</script>
<template>
  <ListModule kind="audit"/>
</template>
