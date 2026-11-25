<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/logs/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.logs.security.read',
  adminTitle: '安全事件'
})
defineI18nRoute(false)
useHead({title: `安全事件 | ${companyBrand.name}`})
</script>
<template>
  <ListModule kind="security"/>
</template>
