<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/parameters/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.parameters.read',
  adminTitle: '系统参数'
})
defineI18nRoute(false)
useHead({title: `系统参数 | ${companyBrand.name}`})
</script>
<template>
  <ListModule/>
</template>
