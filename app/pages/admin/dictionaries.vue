<script setup lang="ts">
import {companyBrand} from '~/config/admin/brand'
import ListModule from '~/components/admin/dictionaries/ListModule.vue'

definePageMeta({
  layout: 'admin',
  admin: true,
  middleware: 'admin',
  adminPermission: 'system.dictionaries.read',
  adminTitle: '数据字典'
})
defineI18nRoute(false)
useHead({title: `数据字典 | ${companyBrand.name}`})
</script>
<template>
  <ListModule/>
</template>
